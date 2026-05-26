import { NextRequest, NextResponse } from 'next/server';
import { getWaybill, getRsCredentialsMap } from '@/lib/integrations/rsge/client';
import { prisma } from '@/lib/prisma';

export const dynamic   = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/waybills/backfill-unit-txt
 *
 * For every waybill that has at least one item with unit_id='99', calls
 * get_waybill(rs_id) to fetch UNIT_TXT and updates the `unit` column on
 * matching items in rs_waybills_in_items.
 *
 * Pagination:
 *   ?limit=N   (default 100) — waybills to process per request
 *   ?offset=N  (default 0)   — skip first N waybills
 *   ?dry_run=true            — report what would change without writing
 *   ?insider_uuid=<uuid>     — limit to one insider
 *
 * Returns: { processed, updated_items, skipped, total_remaining, next_offset }
 */
export async function POST(req: NextRequest) {
  const { requireAuthOrCron, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuthOrCron(req);
  if (isAuthError(auth)) return auth;

  const credMap = getRsCredentialsMap();
  if (credMap.length === 0)
    return NextResponse.json({ error: 'No RS API credentials configured' }, { status: 503 });

  const url       = new URL(req.url);
  const limit     = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 200);
  const offset    = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const dryRun    = url.searchParams.get('dry_run') === 'true';
  const insiderFilter = url.searchParams.get('insider_uuid') ?? undefined;

  // Find distinct waybill rs_ids that have unit_id=99 items
  const waybillRows = await prisma.rs_waybills_in_items.findMany({
    where: {
      unit_id: '99',
      ...(insiderFilter ? { insider_uuid: insiderFilter } : {}),
    },
    select:   { rs_id: true, insider_uuid: true },
    distinct: ['rs_id'],
    orderBy:  { rs_id: 'asc' },
    skip:  offset,
    take:  limit + 1, // fetch one extra to know if there are more
  });

  const hasMore = waybillRows.length > limit;
  const batch   = waybillRows.slice(0, limit);

  // Build a map from insider_uuid → credential
  const credByInsider = new Map(credMap.map((c) => [c.insiderUuid, c]));

  let processed    = 0;
  let updatedItems = 0;
  let skipped      = 0;
  const errors: string[] = [];

  for (const { rs_id, insider_uuid } of batch) {
    if (!rs_id) { skipped++; continue; }

    const cred = insider_uuid ? credByInsider.get(insider_uuid) : credMap[0];
    if (!cred) { skipped++; continue; }

    try {
      const goods = await getWaybill(cred.su, cred.sp, rs_id);

      // Build lookup: goods_code → unit_txt  (fallback: goods_name → unit_txt)
      const byCode = new Map<string, string>();
      const byName = new Map<string, string>();
      for (const g of goods) {
        if (g.unit_id !== '99') continue; // only care about custom units
        const txt = g.unit_txt?.trim() || null;
        if (!txt) continue;
        if (g.goods_code) byCode.set(g.goods_code, txt);
        if (g.goods_name) byName.set(g.goods_name, txt);
      }

      if (byCode.size === 0 && byName.size === 0) { processed++; continue; }

      // Fetch DB items for this waybill with unit_id=99
      const dbItems = await prisma.rs_waybills_in_items.findMany({
        where:  { rs_id, unit_id: '99' },
        select: { id: true, goods_code: true, goods_name: true, unit: true },
      });

      for (const item of dbItems) {
        const newUnit =
          (item.goods_code ? byCode.get(item.goods_code) : undefined) ??
          (item.goods_name ? byName.get(item.goods_name) : undefined) ??
          null;

        if (!newUnit || newUnit === item.unit) continue;

        if (!dryRun) {
          await prisma.rs_waybills_in_items.update({
            where: { id: item.id },
            data:  { unit: newUnit },
          });
        }
        updatedItems++;
      }

      processed++;
    } catch (err) {
      errors.push(`${rs_id}: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }

    // Brief pause to avoid hammering RS.ge API
    await new Promise((r) => setTimeout(r, 200));
  }

  const total99Remaining = hasMore
    ? await prisma.rs_waybills_in_items
        .findMany({ where: { unit_id: '99' }, select: { rs_id: true }, distinct: ['rs_id'] })
        .then((r) => r.length - offset - processed)
    : 0;

  return NextResponse.json({
    processed,
    updated_items:  updatedItems,
    skipped,
    dry_run:        dryRun,
    has_more:       hasMore,
    next_offset:    hasMore ? offset + limit : null,
    errors:         errors.slice(0, 10),
  });
}
