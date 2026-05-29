import { NextRequest, NextResponse } from 'next/server';
import { getWaybill, getRsCredentialsMap } from '@/lib/integrations/rsge/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/waybills/backfill-items-per-waybill
 *
 * Fetches goods/line-items for specific waybills using the per-waybill
 * `get_waybill` SOAP call (more reliable than the bulk method for waybills
 * that were missed by `get_buyer_waybilll_goods_list`).
 *
 * Body: { rs_ids: string[] }   — list of rs_id values to backfill
 *
 * Query params:
 *   ?skip_existing=true  (default) — skip waybills that already have items
 *   ?skip_existing=false           — re-insert all (deletes existing first)
 *   ?dry_run=true                  — report counts without writing
 *
 * Returns: { processed, inserted, skipped, already_had_items, errors }
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

  let body: { rs_ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.rs_ids) || body.rs_ids.length === 0)
    return NextResponse.json({ error: 'rs_ids must be a non-empty array' }, { status: 400 });

  const rsIds: string[] = body.rs_ids.map(String);

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
      const goods = await getWaybill(cred.su, cred.sp, rsId);

      if (goods.length === 0) {
        // Waybill exists but has no goods in RS.ge — skip
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
          // Goods-level fields from getWaybill
          goods_name: g.goods_name,
          goods_code: g.goods_code,
          unit_id: g.unit_id,
          unit: g.unit_txt ?? null,
          quantity: g.quantity ? parseFloat(g.quantity) : null,
          unit_price: g.unit_price ? parseFloat(g.unit_price) : null,
          total_price: g.total_price ? parseFloat(g.total_price) : null,
          dimension_uuid: g.unit_txt ? (unitDimMap.get(g.unit_txt) ?? null) : null,
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

    // Small delay to avoid hammering RS.ge
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({
    processed,
    inserted,
    skipped,
    already_had_items: alreadyHadItems,
    dry_run: dryRun,
    errors: errors.slice(0, 20),
  });
}
