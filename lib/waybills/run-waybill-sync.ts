import { prisma } from '@/lib/prisma';
import { getRequiredInsider } from '@/lib/required-insider';
import { batchIsVatPayerTin, getBuyerWaybillsXml } from '@/lib/integrations/rsge/client';
import { RS_WAYBILL_STATUS, RS_WAYBILL_TYPE, rsWaybillConditionLabel } from '@/lib/integrations/rsge/constants';
import { parseStringPromise } from 'xml2js';
import { randomUUID } from 'crypto';

export interface WaybillSyncResult {
  imported: number;
  updated: number;
  sync_batch_id: string | null;
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const normalizeInn = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `0${digits}`;
  return digits;
};

export const normalizeWaybillNo = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 9) return `0${digits}`;
  return digits;
};

const parseDecimal = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s+/g, '').replace(',', '.');
  const num = Number(normalized);
  if (Number.isNaN(num)) return null;
  return normalized;
};

/**
 * rs.ge returns Georgian local time (UTC+4). Append "+04:00" before parsing
 * to get the correct UTC instant regardless of server timezone.
 */
const parseApiDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v === '0001-01-01T00:00:00' || v === '0001-01-01 00:00:00') return null;

  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) {
    const d = new Date(v.replace(' ', 'T') + '+04:00');
    return isNaN(d.getTime()) ? null : d;
  }

  const m = v.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = m;
    const d = new Date(
      `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min.padStart(2, '0')}:${ss.padStart(2, '0')}+04:00`,
    );
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};

const formatDate = (date: Date | null): string | null => {
  if (!date) return null;
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getUTCFullYear()}`;
};

const formatPeriod = (date: Date | null): string | null => {
  if (!date) return null;
  return `${EN_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

const xmlField = (obj: Record<string, any>, ...keys: string[]): string | null => {
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v) && v.length > 0) return String(v[0]).trim() || null;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

const toComparable = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime().toString();
  return String(value);
};

const isDifferent = (
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  keys: readonly string[],
): boolean => keys.some((key) => toComparable(existing[key]) !== toComparable(incoming[key]));

// ---------------------------------------------------------------------------
// XML → DB record mapper
// ---------------------------------------------------------------------------

function mapWaybillRecord(
  w: Record<string, any>,
  counteragentMap: Map<string, string>,
  insiderUuid: string,
  syncBatchId: string,
) {
  const counteragentInn = normalizeInn(xmlField(w, 'SELLER_TIN', 'seller_tin', 'SellerTin'));
  const counteragentName = xmlField(w, 'SELLER_NAME', 'seller_name', 'SellerName') ?? null;
  const counteragentUuid = counteragentInn ? (counteragentMap.get(counteragentInn) ?? null) : null;
  const counteragent =
    counteragentInn || counteragentName
      ? `(${counteragentInn ?? ''}) ${counteragentName ?? ''}`.trim()
      : null;

  const driverInn = normalizeInn(xmlField(w, 'DRIVER_TIN', 'driver_tin', 'DriverTin'));
  const driverName = xmlField(w, 'DRIVER_NAME', 'driver_name', 'DriverName');
  const driverUuid = driverInn ? (counteragentMap.get(driverInn) ?? null) : null;
  const driver =
    driverInn || driverName ? `(${driverInn ?? ''}) ${driverName ?? ''}`.trim() : null;

  const rsId = xmlField(w, 'ID', 'id', 'Id', 'waybill_id');
  const waybillNo = normalizeWaybillNo(xmlField(w, 'WAYBILL_NUMBER', 'waybill_number', 'WaybillNumber'));
  const activationTime = parseApiDate(xmlField(w, 'ACTIVATE_DATE', 'activate_date', 'ActivateDate'));

  const statusCode = xmlField(w, 'STATUS', 'status', 'Status');
  const typeCode = xmlField(w, 'TYPE', 'type', 'Type', 'waybill_type');
  const state = statusCode ? (RS_WAYBILL_STATUS[statusCode] ?? statusCode) : null;
  const type = typeCode ? (RS_WAYBILL_TYPE[typeCode] ?? typeCode) : null;

  const isConfirmedRaw = xmlField(w, 'IS_CONFIRMED', 'is_confirmed');
  const isConfirmed = isConfirmedRaw === '1';
  const condition = rsWaybillConditionLabel(isConfirmedRaw);

  const invoiceId = xmlField(w, 'INVOICE_ID', 'invoice_id');

  return {
    rs_id: rsId,
    waybill_no: waybillNo,
    state,
    condition,
    category: xmlField(w, 'CATEGORY', 'category', 'Category'),
    type,
    counteragent,
    counteragent_inn: counteragentInn,
    counteragent_name: counteragentName,
    counteragent_uuid: counteragentUuid,
    vat: false as boolean,
    sum: parseDecimal(xmlField(w, 'FULL_AMOUNT', 'full_amount', 'FullAmount')),
    driver,
    driver_id: driverInn,
    driver_uuid: driverUuid,
    vehicle: xmlField(w, 'CAR_NUMBER', 'car_number', 'CarNumber'),
    transportation_sum: parseDecimal(
      xmlField(w, 'TRANSPORT_COAST', 'TRANSPORT_COST', 'transport_cost', 'TransportCost'),
    ),
    departure_address: xmlField(w, 'START_ADDRESS', 'start_address', 'departure_address', 'DepartureAddress'),
    shipping_address: xmlField(w, 'END_ADDRESS', 'end_address', 'delivery_address', 'DeliveryAddress'),
    activation_time: activationTime,
    transportation_beginning_time: parseApiDate(xmlField(w, 'BEGIN_DATE', 'begin_date', 'BeginDate')),
    submission_time: parseApiDate(xmlField(w, 'DELIVERY_DATE', 'delivery_date', 'DeliveryDate')),
    cancellation_time: parseApiDate(xmlField(w, 'CLOSE_DATE', 'close_date', 'CloseDate')),
    note: xmlField(w, 'WAYBILL_COMMENT', 'waybill_comment', 'comment', 'Comment'),
    vat_doc_id: invoiceId,
    stat: xmlField(w, 'STAT', 'stat', 'Stat'),
    transportation_cost: parseDecimal(
      xmlField(w, 'TRANSPORT_COAST', 'TRANSPORT_COST', 'transport_cost', 'TransportCost'),
    ),
    invoice_id: invoiceId,
    is_confirmed: isConfirmed,
    is_corrected: xmlField(w, 'IS_CORRECTED', 'is_corrected') === '1',
    is_med: xmlField(w, 'IS_MED', 'is_med') === '1',
    create_date: parseApiDate(xmlField(w, 'CREATE_DATE', 'create_date')),
    seller_st: xmlField(w, 'SELLER_ST', 'seller_st'),
    insider_uuid: insiderUuid,
    project_uuid: null as string | null,
    financial_code_uuid: null as string | null,
    corresponding_account: null as string | null,
    date: formatDate(activationTime),
    period: formatPeriod(activationTime),
    import_batch_id: syncBatchId,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

// vat is intentionally excluded — it is locked at first import and must never be
// overwritten by subsequent syncs (counteragent VAT status is a point-in-time snapshot).
const COMPARE_KEYS = [
  'waybill_no',
  'state',
  'condition',
  'category',
  'type',
  'counteragent',
  'counteragent_inn',
  'counteragent_name',
  'counteragent_uuid',
  'sum',
  'driver',
  'driver_id',
  'driver_uuid',
  'vehicle',
  'transportation_sum',
  'departure_address',
  'shipping_address',
  'activation_time',
  'transportation_beginning_time',
  'submission_time',
  'cancellation_time',
  'note',
  'vat_doc_id',
  'stat',
  'transportation_cost',
  'rs_id',
  'date',
  'period',
  'invoice_id',
  'is_confirmed',
  'is_corrected',
  'is_med',
  'create_date',
  'seller_st',
] as const;

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

/**
 * Fetches waybills from RS.ge for the given date range and upserts them into
 * rs_waybills_in_api (single source of truth).
 *
 * VAT lock rule: the counteragent VAT payer status (vat field) is set once at
 * first import and never overwritten — it reflects the state at that exact fetch.
 */
export async function runWaybillSync(
  credentials: { su: string; sp: string },
  dateFrom: Date,
  dateTo: Date,
  options?: { statuses?: string; itypes?: string; insiderUuid?: string },
): Promise<WaybillSyncResult> {
  let innerXml: string;
  try {
    innerXml = await getBuyerWaybillsXml({
      ...credentials,
      createDateS: dateFrom,
      createDateE: dateTo,
      statuses: options?.statuses,
      itypes: options?.itypes,
    });
  } catch (err: unknown) {
    throw err;
  }

  let parsedXml: Record<string, any>;
  try {
    parsedXml = await parseStringPromise(innerXml, { explicitArray: true });
  } catch {
    throw new Error('Failed to parse rs.ge XML response');
  }

  const rootKey = Object.keys(parsedXml)[0] ?? '';
  const rootObj = parsedXml[rootKey] ?? {};
  const childKey = Object.keys(rootObj).find((k) => Array.isArray(rootObj[k])) ?? '';
  const waybillArray: Record<string, any>[] = rootObj[childKey] ?? [];

  if (waybillArray.length === 0) {
    return { imported: 0, updated: 0, sync_batch_id: null, message: 'No waybills returned for date range' };
  }

  const [counteragents, resolvedInsiderUuid] = await Promise.all([
    prisma.counteragents.findMany({
      select: { counteragent_uuid: true, identification_number: true },
    }),
    options?.insiderUuid
      ? Promise.resolve(options.insiderUuid)
      : getRequiredInsider().then((r) => r.insiderUuid),
  ]);

  const counteragentMap = new Map<string, string>();
  for (const c of counteragents) {
    const inn = normalizeInn(c.identification_number ?? '');
    if (inn) counteragentMap.set(inn, c.counteragent_uuid);
  }

  const syncBatchId = randomUUID();
  const records = waybillArray.map((w) =>
    mapWaybillRecord(w, counteragentMap, resolvedInsiderUuid, syncBatchId),
  );

  // Resolve VAT payer status — this is a point-in-time snapshot; stored only on first insert.
  const sellerTins = new Set(records.map((r) => r.counteragent_inn).filter(Boolean) as string[]);
  const vatPayerMap = await batchIsVatPayerTin(credentials.su, credentials.sp, sellerTins);
  for (const r of records) {
    if (r.counteragent_inn && vatPayerMap.has(r.counteragent_inn)) {
      r.vat = vatPayerMap.get(r.counteragent_inn)!;
    }
  }

  const withKey = records.filter((r) => r.rs_id);

  const rsIds = withKey.map((r) => r.rs_id!);

  const apiCreate: typeof withKey = [];
  const apiUpdate: typeof withKey = [];

  // ---------------------------------------------------------------------------
  // Upsert rs_waybills_in_api — single source of truth.
  //    CREATE: includes vat (snapshot at this fetch).
  //    UPDATE: excludes vat — original snapshot is preserved forever.
  // ---------------------------------------------------------------------------
  if (withKey.length > 0) {
    const existingApiRsIds = new Set(
      (
        await prisma.rs_waybills_in_api.findMany({
          where: { rs_id: { in: rsIds } },
          select: { rs_id: true },
        })
      ).map((r) => r.rs_id),
    );

    for (const r of withKey) {
      (existingApiRsIds.has(r.rs_id!) ? apiUpdate : apiCreate).push(r);
    }

    // API fields shared by create and update paths (vat excluded from this base set)
    const toApiBaseFields = (r: (typeof withKey)[0]) => ({
      waybill_no: r.waybill_no,
      state: r.state,
      condition: r.condition,
      category: r.category,
      type: r.type,
      counteragent: r.counteragent,
      counteragent_inn: r.counteragent_inn,
      counteragent_name: r.counteragent_name,
      counteragent_uuid: r.counteragent_uuid,
      insider_uuid: r.insider_uuid,
      sum: r.sum,
      driver: r.driver,
      driver_id: r.driver_id,
      driver_uuid: r.driver_uuid,
      vehicle: r.vehicle,
      transportation_sum: r.transportation_sum,
      departure_address: r.departure_address,
      shipping_address: r.shipping_address,
      activation_time: r.activation_time,
      transportation_beginning_time: r.transportation_beginning_time,
      submission_time: r.submission_time,
      cancellation_time: r.cancellation_time,
      note: r.note,
      vat_doc_id: r.vat_doc_id,
      stat: r.stat,
      transportation_cost: r.transportation_cost,
      invoice_id: r.invoice_id,
      is_confirmed: r.is_confirmed,
      is_corrected: r.is_corrected,
      is_med: r.is_med,
      create_date: r.create_date,
      seller_st: r.seller_st,
      date: r.date,
      period: r.period,
      synced_at: new Date(),
    });

    if (apiCreate.length > 0) {
      await prisma.rs_waybills_in_api.createMany({
        data: apiCreate.map((r) => ({ rs_id: r.rs_id!, vat: r.vat, ...toApiBaseFields(r) })),
        skipDuplicates: true,
      });
    }

    if (apiUpdate.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < apiUpdate.length; i += batchSize) {
        const batch = apiUpdate.slice(i, i + batchSize).map((r) =>
          // vat intentionally omitted — locked at first import
          prisma.rs_waybills_in_api.update({ where: { rs_id: r.rs_id! }, data: toApiBaseFields(r) }),
        );
        await prisma.$transaction(batch);
      }
    }
  }

  return { imported: apiCreate.length, updated: apiUpdate.length, sync_batch_id: syncBatchId };
}
