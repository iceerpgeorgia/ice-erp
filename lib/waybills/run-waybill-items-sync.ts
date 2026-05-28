import { prisma } from '@/lib/prisma';
import { getBuyerWaybillGoodsList, WaybillGoodsItem } from '@/lib/integrations/rsge/client';
import { normalizeWaybillNo } from '@/lib/waybills/run-waybill-sync';
import {
  RS_WAYBILL_STATUS,
  RS_WAYBILL_CONDITION,
  rsTranCostPayerLabel,
} from '@/lib/integrations/rsge/constants';

export interface WaybillItemsSyncResult {
  items_inserted: number;
  items_skipped: number;
  items_errors: number;
  message?: string;
}

/**
 * Build date-range batches for API calls.
 * - Same calendar month → one call with the exact from/to (e.g. today's range).
 * - Spans multiple months → one call per calendar month.
 */
function buildDateRanges(from: Date, to: Date): Array<[Date, Date]> {
  const sameMonth =
    from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth();

  if (sameMonth) return [[from, to]];

  const ranges: Array<[Date, Date]> = [];
  let cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));

  while (cur <= last) {
    const batchStart = cur <= from ? from : new Date(cur);
    const nextMonth = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    const batchEnd = nextMonth <= to ? nextMonth : to;
    ranges.push([batchStart, batchEnd]);
    cur = nextMonth;
  }

  return ranges;
}

/**
 * Map a WaybillGoodsItem from the RS.ge API to a DB-ready record.
 * Resolves status/condition/tran_cost_payer codes to their Georgian labels,
 * matching the behaviour of the manual backfill-items endpoint.
 */
function mapGoodsItemToDb(
  g: WaybillGoodsItem,
  rsId: string,
  waybillNumber: string,
  insiderUuid: string,
  batchId: string,
  unitDimMap: Map<string, string>,
) {
  return {
    rs_id: rsId,
    waybill_no: waybillNumber,
    insider_uuid: insiderUuid,
    // waybill-level fields
    type: g.type,
    create_date: g.create_date ? new Date(g.create_date) : null,
    activate_date: g.activate_date ? new Date(g.activate_date) : null,
    begin_date: g.begin_date ? new Date(g.begin_date) : null,
    cancel_date: g.cancel_date ? new Date(g.cancel_date) : null,
    seller_tin: g.seller_tin,
    seller_name: g.seller_name,
    start_address: g.start_address,
    end_address: g.end_address,
    driver_tin: g.driver_tin,
    driver_name: g.driver_name,
    transport_cost: g.transport_cost ? parseFloat(g.transport_cost) : null,
    full_amount: g.full_amount ? parseFloat(g.full_amount) : null,
    car_number: g.car_number,
    tran_cost_payer: g.tran_cost_payer ? rsTranCostPayerLabel(g.tran_cost_payer) : null,
    trans_id: g.trans_id,
    is_confirmed: g.is_confirmed ? (RS_WAYBILL_CONDITION[g.is_confirmed] ?? g.is_confirmed) : null,
    status: g.status ? (RS_WAYBILL_STATUS[g.status] ?? g.status) : null,
    // goods-line fields
    goods_name: g.goods_name,
    goods_code: g.goods_code,
    unit_id: g.unit_id,
    unit: g.unit,
    quantity: g.quantity ? parseFloat(g.quantity) : null,
    unit_price: g.unit_price ? parseFloat(g.unit_price) : null,
    total_price: g.total_price ? parseFloat(g.total_price) : null,
    vat_type: g.vat_type,
    a_id: g.a_id,
    import_batch_id: batchId,
    dimension_uuid: g.unit ? (unitDimMap.get(g.unit) ?? null) : null,
  };
}

/**
 * Sync waybill line-items for a single insider over a given date range.
 *
 * Design rules:
 * - Waybills that already have items in `rs_waybills_in_items` are skipped to
 *   preserve any user-assigned fields (project, financial code, etc.).
 * - Called after `runWaybillSync` in both the hourly today-cron and the daily
 *   quarterly-cron, so waybill records always exist before items are inserted.
 * - For same-calendar-month ranges (e.g. today) one API call is made; for
 *   multi-month ranges (quarterly) one call is made per calendar month.
 *
 * Returns:
 *   items_inserted — rows written to rs_waybills_in_items
 *   items_skipped  — waybills skipped because items already existed
 *   items_errors   — waybills that produced an insert error
 */
export async function runWaybillItemsSync(
  credentials: { su: string; sp: string },
  dateFrom: Date,
  dateTo: Date,
  options: { insiderUuid: string },
): Promise<WaybillItemsSyncResult> {
  const { su, sp } = credentials;
  const { insiderUuid } = options;

  const batchId = `cron-items-${Date.now()}`;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Preload unit → dimension_uuid map for resolving units on insert
  const unitDimRows = await prisma.rs_unit_dimension_map.findMany({
    where: { dimension_uuid: { not: null } },
    select: { unit_text: true, dimension_uuid: true },
  });
  const unitDimMap = new Map<string, string>(
    unitDimRows
      .filter((r) => r.dimension_uuid != null)
      .map((r) => [r.unit_text, r.dimension_uuid as string]),
  );

  // Build a lookup: waybill_no → rs_id (internal string PK) for this insider.
  const waybillMeta = await prisma.rs_waybills_in_api.findMany({
    where: { insider_uuid: insiderUuid },
    select: { rs_id: true, waybill_no: true },
  });
  const metaByWaybillNo = new Map(
    waybillMeta
      .filter((w) => w.waybill_no)
      .map((w) => [w.waybill_no as string, w.rs_id]),
  );

  if (metaByWaybillNo.size === 0) {
    return { items_inserted: 0, items_skipped: 0, items_errors: 0 };
  }

  // Build set of rs_ids that already have items — these are skipped to protect
  // user-assigned fields (project_uuid, financial_code_uuid, etc.).
  const existingRows = await prisma.rs_waybills_in_items.findMany({
    where: { insider_uuid: insiderUuid, rs_id: { not: null } },
    select: { rs_id: true },
    distinct: ['rs_id'],
  });
  const existingRsIds = new Set(existingRows.map((r) => r.rs_id as string));

  const ranges = buildDateRanges(dateFrom, dateTo);

  for (const [batchStart, batchEnd] of ranges) {
    let goods: WaybillGoodsItem[];
    try {
      const result = await getBuyerWaybillGoodsList(su, sp, batchStart, batchEnd);
      if (!Array.isArray(result) || result.length === 0) continue;
      goods = result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[runWaybillItemsSync] ${insiderUuid} ${batchStart.toISOString().slice(0, 10)}:`,
        msg,
      );
      totalErrors += 1;
      continue;
    }

    // Group items by waybill_id (= WAYBILL_NUMBER from RS.ge)
    const byWaybill = new Map<string, WaybillGoodsItem[]>();
    for (const g of goods) {
      if (!g.waybill_id) continue;
      if (!byWaybill.has(g.waybill_id)) byWaybill.set(g.waybill_id, []);
      byWaybill.get(g.waybill_id)!.push(g);
    }

    for (const [waybillNumber, items] of byWaybill) {
      const rsId = metaByWaybillNo.get(normalizeWaybillNo(waybillNumber) ?? waybillNumber);
      if (!rsId) continue; // not in our DB — waybill sync hasn't seen it yet

      if (existingRsIds.has(rsId)) {
        totalSkipped += 1;
        continue;
      }

      try {
        const ins = await prisma.rs_waybills_in_items.createMany({
          data: items.map((g) => mapGoodsItemToDb(g, rsId, waybillNumber, insiderUuid, batchId, unitDimMap)),
          skipDuplicates: true,
        });
        totalInserted += ins.count;
        // Mark as done so subsequent months don't try to re-insert for this waybill
        existingRsIds.add(rsId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[runWaybillItemsSync] insert ${waybillNumber}:`, msg);
        totalErrors += 1;
      }
    }
  }

  return {
    items_inserted: totalInserted,
    items_skipped: totalSkipped,
    items_errors: totalErrors,
  };
}
