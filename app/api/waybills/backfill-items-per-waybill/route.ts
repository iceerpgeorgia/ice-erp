import { NextRequest, NextResponse } from 'next/server';
import { getBuyerWaybillGoodsListByNumber, getRsCredentialsMap } from '@/lib/integrations/rsge/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/waybills/backfill-items-per-waybill
 *
 * Fetches goods/line-items for specific waybills using the
 * `get_buyer_waybilll_goods_list` SOAP method filtered by waybill_number
 * (more reliable for waybills that were missed by the date-range bulk sync).
 *
 * Body (one of):
 *   { rs_ids: string[] }         — specific rs_id values to backfill
 *   { all_missing: true,         — backfill all waybills missing items
 *     limit?: number,            — max to process (default 400)
 *     offset?: number }          — for pagination (default 0)
 *
 * Query params:
 *   ?skip_existing=true  (default) — skip waybills that already have items
 *   ?skip_existing=false           — re-insert all (deletes existing first)
 *   ?dry_run=true                  — report counts without writing
 *
 * Returns: { processed, inserted, skipped, already_had_items, errors, total_missing?, next_offset? }
 */
export async function POST(req: NextRequest) {
  const { requireAuthOrCron, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuthOrCron(req);
  if (isAuthError(auth)) return auth;

  const credMap = getRsCredentialsMap();
  if (credMap.length === 0)
    return NextResponse.json({ error: 'No RS API credentials configured' }, { status: 503 });

  const url = new URL(req.url);
  const skipExisting = url.searchParams.get('skip_existing') !== 'false';
  const dryRun = url.searchParams.get('dry_run') === 'true';

  let body: { rs_ids?: unknown; all_missing?: unknown; limit?: unknown; offset?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let rsIds: string[];
  let totalMissing: number | undefined;
  let nextOffset: number | undefined;

  if (body.all_missing === true) {
    // Find all rs_ids that have no items in rs_waybills_in_items
    const limit = typeof body.limit === 'number' ? Math.min(body.limit, 500) : 150;
    const offset = typeof body.offset === 'number' ? body.offset : 0;

    const allWaybills = await prisma.rs_waybills_in_api.findMany({
      select: { rs_id: true },
      orderBy: { rs_id: 'asc' },
    });
    const withItems = await prisma.rs_waybills_in_items.findMany({
      select: { rs_id: true },
      distinct: ['rs_id'],
    });
    const hasItemsSet = new Set(withItems.map((r) => r.rs_id as string));
    const allMissing = allWaybills
      .map((w) => w.rs_id as string)
      .filter((id) => !hasItemsSet.has(id));

    totalMissing = allMissing.length;
    const page = allMissing.slice(offset, offset + limit);
    rsIds = page;
    nextOffset = offset + page.length < totalMissing ? offset + page.length : undefined;
  } else {
    if (!Array.isArray(body.rs_ids) || body.rs_ids.length === 0)
      return NextResponse.json({ error: 'Provide rs_ids array or all_missing:true' }, { status: 400 });
    rsIds = (body.rs_ids as unknown[]).map(String);
  }

  // Load waybill metadata from DB
  const waybillRows = await prisma.rs_waybills_in_api.findMany({
    where: { rs_id: { in: rsIds } },
    select: {
      rs_id: true,
      waybill_no: true,
      insider_uuid: true,
      type: true,
      create_date: true,
      activation_time: true,
      transportation_beginning_time: true,
      cancellation_time: true,
      counteragent_inn: true,
      counteragent_name: true,
      departure_address: true,
      shipping_address: true,
      driver: true,
      driver_id: true,
      vehicle: true,
      transportation_sum: true,
      sum: true,
    },
  });

  const waybillMap = new Map(waybillRows.map((w) => [w.rs_id, w]));

  // Find which rs_ids already have items
  const existingItems = await prisma.rs_waybills_in_items.findMany({
    where: { rs_id: { in: rsIds } },
    select: { rs_id: true },
    distinct: ['rs_id'],
  });
  const existingSet = new Set(existingItems.map((r) => r.rs_id as string));

  // Build insider→credentials map
  const credByInsider = new Map(credMap.map((c) => [c.insiderUuid, c]));

  // Load unit→dimension_uuid map for dimension resolution
  const unitDimRows = await prisma.rs_unit_dimension_map.findMany({
    where: { dimension_uuid: { not: null } },
    select: { unit_text: true, dimension_uuid: true },
  });
  const unitDimMap = new Map<string, string>(
    unitDimRows
      .filter((r) => r.dimension_uuid != null)
      .map((r) => [r.unit_text, r.dimension_uuid as string]),
  );

  const batchId = `per-waybill-${Date.now()}`;
  let processed = 0;
  let inserted = 0;
  let skipped = 0;
  let alreadyHadItems = 0;
  const errors: string[] = [];

  for (const rsId of rsIds) {
    const meta = waybillMap.get(rsId);
    if (!meta) {
      errors.push(`${rsId}: not found in DB`);
      skipped++;
      continue;
    }

    if (skipExisting && existingSet.has(rsId)) {
      alreadyHadItems++;
      continue;
    }

    const cred = meta.insider_uuid ? credByInsider.get(meta.insider_uuid) : credMap[0];
    if (!cred) {
      errors.push(`${rsId}: no credentials for insider ${meta.insider_uuid}`);
      skipped++;
      continue;
    }

    try {
      const waybillNo = meta.waybill_no ?? rsId;
      const goods = await getBuyerWaybillGoodsListByNumber(cred.su, cred.sp, waybillNo);

      if (goods.length === 0) {
        // Waybill exists but has no goods in RS.ge — skip
        errors.push(`${rsId} (${waybillNo}): RS.ge returned 0 goods`);
        processed++;
        skipped++;
        continue;
      }

      if (!dryRun) {
        if (!skipExisting && existingSet.has(rsId)) {
          // Delete existing items before re-inserting
          await prisma.rs_waybills_in_items.deleteMany({ where: { rs_id: rsId } });
        }

        const records = goods.map((g) => ({
          rs_id: rsId,
          waybill_no: meta.waybill_no ?? null,
          insider_uuid: meta.insider_uuid ?? null,
          import_batch_id: batchId,
          // Waybill-level fields from rs_waybills_in_api
          type: meta.type ?? null,
          create_date: meta.create_date ?? null,
          activate_date: meta.activation_time ?? null,
          begin_date: meta.transportation_beginning_time ?? null,
          cancel_date: meta.cancellation_time ?? null,
          seller_tin: meta.counteragent_inn ?? null,
          seller_name: meta.counteragent_name ?? null,
          start_address: meta.departure_address ?? null,
          end_address: meta.shipping_address ?? null,
          driver_name: meta.driver ?? null,
          driver_tin: meta.driver_id ?? null,
          car_number: meta.vehicle ?? null,
          transport_cost: meta.transportation_sum ? Number(meta.transportation_sum) : null,
          full_amount: meta.sum ? Number(meta.sum) : null,
          // Goods-level fields from getBuyerWaybillGoodsListByNumber
          goods_name: g.goods_name,
          goods_code: g.goods_code,
          unit_id: g.unit_id,
          unit: g.unit ?? null,
          quantity: g.quantity ? parseFloat(g.quantity) : null,
          unit_price: g.unit_price ? parseFloat(g.unit_price) : null,
          total_price: g.total_price ? parseFloat(g.total_price) : null,
          dimension_uuid: g.unit ? (unitDimMap.get(g.unit) ?? null) : null,
        }));

        const result = await prisma.rs_waybills_in_items.createMany({
          data: records,
          skipDuplicates: true,
        });
        inserted += result.count;
      } else {
        // dry_run: count what would be inserted
        inserted += goods.length;
      }

      existingSet.add(rsId);
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${rsId}: ${msg}`);
      skipped++;
    }
  }

  return NextResponse.json({
    processed,
    inserted,
    skipped,
    already_had_items: alreadyHadItems,
    dry_run: dryRun,
    errors: errors.slice(0, 50),
    ...(totalMissing !== undefined && { total_missing: totalMissing }),
    ...(nextOffset !== undefined && { next_offset: nextOffset }),
  });
}
