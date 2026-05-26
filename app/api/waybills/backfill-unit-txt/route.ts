import { NextRequest, NextResponse } from 'next/server';
import { getBuyerWaybillGoodsByNumber, getRsCredentialsMap } from '@/lib/integrations/rsge/client';
import { prisma } from '@/lib/prisma';

export const dynamic   = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/waybills/backfill-unit-txt
 *
 * For every waybill that has at least one item with unit_id='99' and unit='სხვ',
 * calls get_buyer_waybilll_goods_list (with waybill_number filter) to fetch
 * UNIT_TXT and updates the `unit` column on matching items.
 *
 * Pagination:
 *   ?limit=N            (default 50, max 100) — waybills to process per request
 *   ?offset=N           (default 0)           — skip first N waybills
 *   ?dry_run=true                             — report without writing
 *   ?insider_uuid=<uuid>                      — limit to one insider
 *
 * Returns: { processed, updated_items, skipped, dry_run, has_more, next_offset, errors }
 */
export async function POST(req: NextRequest) {
  const { requireAuthOrCron, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuthOrCron(req);
  if (isAuthError(auth)) return auth;

  const credMap = getRsCredentialsMap();
  if (credMap.length === 0)
    return NextResponse.json({ error: 'No RS API credentials configured' }, { status: 503 });

  const url       = new URL(req.url);
  const limit     = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);
  const offset    = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const dryRun    = url.searchParams.get('dry_run') === 'true';
  const insiderFilter = url.searchParams.get('insider_uuid') ?? undefined;

  // Find distinct waybill_no values that have unit_id=99, unit='სხვ' items
  // (waybill_no is the RS.ge WAYBILL_NUMBER used to call the buyer goods API)
  const waybillRows = await prisma.rs_waybills_in_items.findMany({
    where: {
      unit_id: '99',
      unit:    'სხვ',
      waybill_no: { not: null },
      ...(insiderFilter ? { insider_uuid: insiderFilter } : {}),
    },
    select:   { waybill_no: true, insider_uuid: true },
    distinct: ['waybill_no'],
    orderBy:  { waybill_no: 'asc' },
    skip:  offset,
    take:  limit + 1,
  });

  const hasMore = waybillRows.length > limit;
  const batch   = waybillRows.slice(0, limit);

  const credByInsider = new Map(credMap.map((c) => [c.insiderUuid, c]));

  let processed    = 0;
  let updatedItems = 0;
  let skipped      = 0;
  const errors: string[] = [];

  for (const { waybill_no, insider_uuid } of batch) {
    if (!waybill_no) { skipped++; continue; }

    const cred = insider_uuid ? credByInsider.get(insider_uuid) : credMap[0];
    if (!cred) { skipped++; continue; }

    try {
      const { byCode, byName } = await getBuyerWaybillGoodsByNumber(cred.su, cred.sp, waybill_no);

      if (byCode.size === 0 && byName.size === 0) { processed++; continue; }

      const dbItems = await prisma.rs_waybills_in_items.findMany({
        where:  { waybill_no, unit_id: '99', unit: 'სხვ' },
        select: { id: true, goods_code: true, goods_name: true },
      });

      for (const item of dbItems) {
        const newUnit =
          (item.goods_code ? byCode.get(item.goods_code) : undefined) ??
          (item.goods_name ? byName.get(item.goods_name) : undefined) ??
          null;

        if (!newUnit) continue;

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
      errors.push(`${waybill_no}: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

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
