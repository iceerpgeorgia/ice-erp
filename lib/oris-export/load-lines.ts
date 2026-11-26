import { prisma, withRetry } from '@/lib/prisma';
import { formatActivationDate } from '@/lib/waybills/activation-date';
import type { OrisLine } from './entries';

/**
 * Incoming waybill lines of one insider whose waybill was activated within [from, to] (Tbilisi days,
 * yyyy-mm-dd). The line's own account and project win over its waybill's (like the sheet's
 * WB_To_Items fill-down).
 */
export async function loadOrisLines(insiderUuid: string, from: string, to: string): Promise<OrisLine[]> {
  const rows = await withRetry(() =>
    prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        waybill_no: string | null;
        activation_time: Date | null;
        supplier_name: string | null;
        supplier_oris: string | null;
        counteragent_uuid: string | null;
        state: string | null;
        type: string | null;
        vat: boolean;
        total_price: string | null;
        goods_name: string | null;
        unit: string | null;
        quantity: string | null;
        start_address: string | null;
        end_address: string | null;
        account: string | null;
        inventory_code: string | null;
        project_name: string | null;
        project_1630: string | null;
      }>
    >(
      `SELECT i.id, coalesce(w.waybill_no, i.waybill_no) AS waybill_no, w.activation_time,
              coalesce(c.name, w.counteragent_name) AS supplier_name, nullif(btrim(c.oris_id), '') AS supplier_oris,
              w.counteragent_uuid::text AS counteragent_uuid, w.state, w.type, w.vat,
              i.total_price::text AS total_price, i.goods_name, coalesce(d.dimension, i.unit) AS unit, i.quantity::text AS quantity,
              coalesce(nullif(nullif(btrim(i.start_address), ''), 'null'), w.departure_address) AS start_address,
              coalesce(nullif(nullif(btrim(i.end_address), ''), 'null'), w.shipping_address) AS end_address,
              nullif(btrim(coalesce(i.corresponding_account, w.corresponding_account)), '') AS account,
              nullif(btrim(v.internal_number), '') AS inventory_code,
              p.project_name, nullif(btrim(p.oris_1630), '') AS project_1630
         FROM rs_waybills_in_items i
         JOIN rs_waybills_in_api w ON w.rs_id = i.rs_id
         LEFT JOIN counteragents c ON c.counteragent_uuid = w.counteragent_uuid
         LEFT JOIN inventories v ON v.uuid = i.inventory_uuid
         -- The sheet sent the unit's full name (ცალი, მეტრი), which is our dimension name.
         LEFT JOIN dimensions d ON d.uuid = i.dimension_uuid
         LEFT JOIN projects p ON p.project_uuid = coalesce(i.project_uuid, w.project_uuid)
        WHERE i.insider_uuid = $1::uuid
          AND w.activation_time >= ($2::date)::timestamp AT TIME ZONE 'Asia/Tbilisi'
          AND w.activation_time < ($3::date + 1)::timestamp AT TIME ZONE 'Asia/Tbilisi'
        ORDER BY w.activation_time, coalesce(w.waybill_no, i.waybill_no), i.id`,
      insiderUuid,
      from,
      to
    )
  );

  return rows.map((row) => ({
    itemId: String(row.id),
    // ORIS gets the waybill number as the sheet sent it: without leading zeros.
    waybillNo: (row.waybill_no ?? '').trim().replace(/^0+(?=\d)/, ''),
    date: formatActivationDate(row.activation_time) ?? '',
    supplierName: row.supplier_name,
    supplierOris: row.supplier_oris,
    isOwnCompany: row.counteragent_uuid === insiderUuid,
    state: row.state,
    type: row.type,
    vat: row.vat,
    total: Number(row.total_price ?? 0),
    goodsName: row.goods_name,
    unit: row.unit,
    quantity: row.quantity === null ? null : Number(row.quantity),
    startAddress: row.start_address,
    endAddress: row.end_address,
    account: row.account,
    inventoryCode: row.inventory_code,
    projectName: row.project_name,
    project1630: row.project_1630,
  }));
}
