import { NextRequest, NextResponse } from 'next/server';
import { getBuyerWaybillGoodsList, getRsCredentialsMap } from '@/lib/integrations/rsge/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
// Allow up to 300 s on Vercel Pro
export const maxDuration = 300;

/** Build [monthStart, monthEnd) pairs for every calendar month between two dates. */
function monthlyRanges(start: Date, end: Date): Array<[Date, Date]> {
  const ranges: Array<[Date, Date]> = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cur <= last) {
    const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    ranges.push([new Date(cur), next]);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return ranges;
}

/**
 * POST /api/waybills/backfill-items
 *
 * Fetches goods/line-items from rs.ge using get_buyer_waybilll_goods_list
 * (bulk, per calendar month) and inserts into rs_waybills_in_items.
 *
 * Query params:
 *   ?skip_existing=true  (default) — skip waybills that already have items
 *   ?skip_existing=false           — re-insert ALL (deletes existing first)
 *   ?insider_uuid=<uuid>           — limit to a single insider
 *   ?from=YYYY-MM                  — start from this month  (default: earliest in DB)
 *   ?to=YYYY-MM                    — end at this month      (default: latest in DB)
 *   ?raw=true                      — return raw XML for first month (debug)
 */
export async function POST(req: NextRequest) {
  const { requireAuthOrCron, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuthOrCron(req);
  if (isAuthError(auth)) return auth;

  const credMap = getRsCredentialsMap();
  if (credMap.length === 0) {
    return NextResponse.json({ error: 'No RS API credentials configured' }, { status: 503 });
  }

  const url = new URL(req.url);
  const skipExisting = url.searchParams.get('skip_existing') !== 'false';
  const insiderFilter = url.searchParams.get('insider_uuid') ?? undefined;
  const rawMode = url.searchParams.get('raw') === 'true';
  const fromParam = url.searchParams.get('from'); // e.g. "2024-01"
  const toParam = url.searchParams.get('to');     // e.g. "2025-12"

  const insidersToProcess = insiderFilter
    ? credMap.filter((c) => c.insiderUuid === insiderFilter)
    : credMap;

  if (insidersToProcess.length === 0) {
    return NextResponse.json({ error: 'No matching insider credentials' }, { status: 400 });
  }

  const batchId = `backfill-${Date.now()}`;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const errorSamples: string[] = [];

  for (const cred of insidersToProcess) {
    // Determine date range from DB (or from query params)
    const bounds = await prisma.rs_waybills_in_api.aggregate({
      where: { insider_uuid: cred.insiderUuid },
      _min: { create_date: true },
      _max: { create_date: true },
    });

    let rangeStart = bounds._min.create_date ?? new Date();
    let rangeEnd = bounds._max.create_date ?? new Date();
    if (fromParam) rangeStart = new Date(`${fromParam}-01T00:00:00Z`);
    if (toParam)   rangeEnd   = new Date(`${toParam}-28T00:00:00Z`);

    const ranges = monthlyRanges(rangeStart, rangeEnd);
    if (ranges.length === 0) continue;

    // Build a lookup: rs_id → waybill_no for this insider
    const waybillMeta = await prisma.rs_waybills_in_api.findMany({
      where: { insider_uuid: cred.insiderUuid },
      select: { rs_id: true, waybill_no: true },
    });
    const metaByRsId = new Map(waybillMeta.map((w) => [w.rs_id, w.waybill_no]));

    // Build set of rs_ids that already have items (skip_existing mode)
    let existingRsIds: Set<string> = new Set();
    if (skipExisting) {
      const existing = await prisma.rs_waybills_in_items.findMany({
        where: { insider_uuid: cred.insiderUuid, rs_id: { not: null } },
        select: { rs_id: true },
        distinct: ['rs_id'],
      });
      existingRsIds = new Set(existing.map((r) => r.rs_id as string));
    }

    for (const [monthStart, monthEnd] of ranges) {
      try {
        const result = await getBuyerWaybillGoodsList(
          cred.su,
          cred.sp,
          monthStart,
          monthEnd,
          rawMode,
        );

        // Raw debug mode — return immediately
        if (rawMode) {
          return NextResponse.json({
            raw: typeof result === 'string' ? result.slice(0, 8000) : result,
            month: monthStart.toISOString().slice(0, 7),
            insider_uuid: cred.insiderUuid,
          });
        }

        const goods = result as Awaited<ReturnType<typeof getBuyerWaybillGoodsList>>;
        if (!Array.isArray(goods) || goods.length === 0) continue;

        // Group items by waybill_id
        const byWaybill = new Map<string, typeof goods>();
        for (const g of goods) {
          const wid = g.waybill_id;
          if (!wid) continue;
          if (!byWaybill.has(wid)) byWaybill.set(wid, []);
          byWaybill.get(wid)!.push(g);
        }

        for (const [waybillId, items] of byWaybill) {
          // Only insert for waybills we know about
          if (!metaByRsId.has(waybillId)) continue;

          if (skipExisting && existingRsIds.has(waybillId)) {
            totalSkipped += 1;
            continue;
          }

          if (!skipExisting) {
            await prisma.rs_waybills_in_items.deleteMany({ where: { rs_id: waybillId } });
          }

          try {
            const ins = await prisma.rs_waybills_in_items.createMany({
              data: items.map((g) => ({
                rs_id: waybillId,
                waybill_no: metaByRsId.get(waybillId) ?? null,
                insider_uuid: cred.insiderUuid,
                goods_name: g.goods_name,
                goods_code: g.goods_code,
                unit: g.unit,
                quantity: g.quantity ? parseFloat(g.quantity) : null,
                unit_price: g.unit_price ? parseFloat(g.unit_price) : null,
                total_price: g.total_price ? parseFloat(g.total_price) : null,
                taxation: g.taxation,
                import_batch_id: batchId,
              })),
              skipDuplicates: true,
            });
            totalInserted += ins.count;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            totalErrors += 1;
            if (errorSamples.length < 3) errorSamples.push(`insert ${waybillId}: ${msg}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const label = `${cred.insiderUuid} ${monthStart.toISOString().slice(0, 7)}`;
        console.error(`[backfill-items] ${label}:`, msg);
        totalErrors += 1;
        if (errorSamples.length < 3) errorSamples.push(`${label}: ${msg}`);
      }
    }
  }

  return NextResponse.json({
    inserted: totalInserted,
    skipped: totalSkipped,
    errors: totalErrors,
    batch_id: batchId,
    ...(errorSamples.length > 0 ? { error_samples: errorSamples } : {}),
  });
}
