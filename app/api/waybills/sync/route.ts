import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequiredInsider } from '@/lib/required-insider';
import { batchIsVatPayerTin, getBuyerWaybillsXml, getRsApiCredentials } from '@/lib/integrations/rsge/client';
import { RS_WAYBILL_STATUS, RS_WAYBILL_TYPE, rsWaybillConditionLabel } from '@/lib/integrations/rsge/constants';
import { parseStringPromise } from 'xml2js';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
// Allow up to 60 s on Vercel for large date ranges
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Helpers (mirror import route — kept local to avoid coupling)
// ---------------------------------------------------------------------------

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const normalizeInn = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `0${digits}`;
  return digits;
};

const normalizeWaybillNo = (value: string | null | undefined): string | null => {
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
 * Parses common date formats returned by rs.ge SOAP API.
 * Handles ISO ("2024-01-15T12:30:00"), slash ("15/01/2024 12:30:00"),
 * and dot-separated ("15.01.2024 12:30:00") styles.
 */
const parseApiDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v === '0001-01-01T00:00:00' || v === '0001-01-01 00:00:00') return null;

  // ISO or close variant: "2024-01-15T12:30:00" or "2024-01-15 12:30:00"
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) {
    const d = new Date(v.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY HH:MM:SS or DD.MM.YYYY HH:MM:SS
  const m = v.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = m;
    const d = new Date(
      `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min.padStart(2, '0')}:${ss.padStart(2, '0')}`,
    );
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};

const formatDate = (date: Date | null): string | null => {
  if (!date) return null;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
};

const formatPeriod = (date: Date | null): string | null => {
  if (!date) return null;
  return `${EN_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/** Safely read the first element of an xml2js array field. */
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

const isDifferent = (existing: Record<string, unknown>, incoming: Record<string, unknown>, keys: string[]): boolean =>
  keys.some((key) => toComparable(existing[key]) !== toComparable(incoming[key]));

// ---------------------------------------------------------------------------
// XML → DB record mapper
//
// rs.ge does not publish the inner XML schema formally.
// Field names below were derived from the SOAP parameter names and common
// Georgian Revenue Service API conventions.
// Run POST /api/waybills/sync with body {"raw":true} to inspect actual field
// names returned by the API and adjust the aliases here if needed.
// ---------------------------------------------------------------------------
function mapWaybillRecord(
  w: Record<string, any>,
  counteragentMap: Map<string, string>,
  insiderUuid: string,
  syncBatchId: string,
) {
  // Counteragent: for buyer waybills the SELLER is our counteragent
  // Field names from actual rs.ge SOAP response use ALL_CAPS (e.g. SELLER_TIN, SELLER_NAME)
  const counteragentInn = normalizeInn(
    xmlField(w, 'SELLER_TIN', 'seller_tin', 'SellerTin'),
  );
  const counteragentName =
    xmlField(w, 'SELLER_NAME', 'seller_name', 'SellerName') ?? null;
  const counteragentUuid = counteragentInn ? (counteragentMap.get(counteragentInn) ?? null) : null;

  // Build a formatted counteragent string matching the CSV import pattern
  const counteragent =
    counteragentInn || counteragentName
      ? `(${counteragentInn ?? ''}) ${counteragentName ?? ''}`.trim()
      : null;

  const driverInn = normalizeInn(
    xmlField(w, 'DRIVER_TIN', 'driver_tin', 'DriverTin'),
  );
  const driverName = xmlField(w, 'DRIVER_NAME', 'driver_name', 'DriverName');
  const driverUuid = driverInn ? (counteragentMap.get(driverInn) ?? null) : null;
  const driver =
    driverInn || driverName ? `(${driverInn ?? ''}) ${driverName ?? ''}`.trim() : null;

  const rsId = xmlField(w, 'ID', 'id', 'Id', 'waybill_id');
  const waybillNo = normalizeWaybillNo(
    xmlField(w, 'WAYBILL_NUMBER', 'waybill_number', 'WaybillNumber'),
  );

  // ACTIVATE_DATE = when the waybill was activated (matches portal "Activation Period")
  const activationTime = parseApiDate(
    xmlField(w, 'ACTIVATE_DATE', 'activate_date', 'ActivateDate'),
  );

  // STATUS and TYPE are numeric codes — map to Georgian display labels for storage
  const statusCode = xmlField(w, 'STATUS', 'status', 'Status');
  const typeCode = xmlField(w, 'TYPE', 'type', 'Type', 'waybill_type');
  const state = statusCode ? (RS_WAYBILL_STATUS[statusCode] ?? statusCode) : null;
  const type = typeCode ? (RS_WAYBILL_TYPE[typeCode] ?? typeCode) : null;

  // IS_CONFIRMED: 0 = მისაღები (pending), 1 = მიღებული (received)
  const isConfirmedRaw = xmlField(w, 'IS_CONFIRMED', 'is_confirmed');
  const isConfirmed = isConfirmedRaw === '1';
  const condition = rsWaybillConditionLabel(isConfirmedRaw);

  // INVOICE_ID = VAT invoice document ID (same as vat_doc_id in legacy CSV import)
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
    vat: false, // VAT payer status is a counteragent property, not derivable from waybill fields
    sum: parseDecimal(xmlField(w, 'FULL_AMOUNT', 'full_amount', 'FullAmount')),
    driver,
    driver_id: driverInn,
    driver_uuid: driverUuid,
    vehicle: xmlField(w, 'CAR_NUMBER', 'car_number', 'CarNumber'),
    transportation_sum: parseDecimal(
      // API uses TRANSPORT_COAST (sic) for the transport cost field
      xmlField(w, 'TRANSPORT_COAST', 'TRANSPORT_COST', 'transport_cost', 'TransportCost'),
    ),
    departure_address: xmlField(w, 'START_ADDRESS', 'start_address', 'departure_address', 'DepartureAddress'),
    shipping_address: xmlField(w, 'END_ADDRESS', 'end_address', 'delivery_address', 'DeliveryAddress'),
    activation_time: activationTime,
    transportation_beginning_time: parseApiDate(
      // BEGIN_DATE = transport start date (separate from ACTIVATE_DATE)
      xmlField(w, 'BEGIN_DATE', 'begin_date', 'BeginDate'),
    ),
    submission_time: parseApiDate(
      xmlField(w, 'DELIVERY_DATE', 'delivery_date', 'DeliveryDate'),
    ),
    cancellation_time: parseApiDate(
      xmlField(w, 'CLOSE_DATE', 'close_date', 'CloseDate'),
    ),
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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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
  'vat',
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

export async function POST(req: NextRequest) {
  const { requireAuthOrCron, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuthOrCron(req);
  if (isAuthError(auth)) return auth;

  let credentials: { su: string; sp: string };
  try {
    credentials = getRsApiCredentials();
  } catch {
    return NextResponse.json(
      { error: 'RS_API_SU and RS_API_SP environment variables are not configured' },
      { status: 503 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // accept empty body — defaults to last 30 days
  }

  const { begin_date, end_date, statuses, itypes, raw } = body as {
    /** Filter start date — maps to create_date_s (portal Activation Period). ISO string. */
    begin_date?: string;
    /** Filter end date — maps to create_date_e. ISO string. */
    end_date?: string;
    statuses?: string;
    itypes?: string;
    /** Pass raw:true to return the parsed XML object for field inspection */
    raw?: boolean;
  };

  // rs.ge: use create_date_s/e which matches the portal's "Activation Period" filter.
  // begin_date_s/e filters by transport start date and returns -1064 (no results) when
  // the company has no waybills with BEGIN_DATE in that range.
  const createDateS = begin_date
    ? new Date(begin_date)
    : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const createDateE = end_date ? new Date(end_date) : new Date();

  let innerXml: string;
  try {
    innerXml = await getBuyerWaybillsXml({
      ...credentials,
      createDateS,
      createDateE,
      statuses,
      itypes,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/waybills/sync] SOAP error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Debug / field-inspection mode — does not write to DB
  if (raw) {
    let parsed: unknown;
    try {
      parsed = await parseStringPromise(innerXml, { explicitArray: true });
    } catch {
      parsed = innerXml;
    }
    return NextResponse.json({ raw: parsed });
  }

  // Parse the inner XML
  let parsedXml: Record<string, any>;
  try {
    parsedXml = await parseStringPromise(innerXml, { explicitArray: true });
  } catch (err: unknown) {
    console.error('[POST /api/waybills/sync] XML parse error:', err);
    return NextResponse.json({ error: 'Failed to parse rs.ge XML response' }, { status: 502 });
  }

  // Navigate to the waybill array — rs.ge typically returns <waybills><waybill>...</waybill></waybills>
  // or <wb_list><wb>...</wb></wb_list>. We look for the first array-valued key.
  const rootKey = Object.keys(parsedXml)[0] ?? '';
  const rootObj = parsedXml[rootKey] ?? {};
  const childKey = Object.keys(rootObj).find((k) => Array.isArray(rootObj[k])) ?? '';
  const waybillArray: Record<string, any>[] = rootObj[childKey] ?? [];

  if (waybillArray.length === 0) {
    return NextResponse.json({ imported: 0, updated: 0, sync_batch_id: null, message: 'No waybills returned for date range' });
  }

  // Load counteragent map and insider
  const [counteragents, insider] = await Promise.all([
    prisma.counteragents.findMany({
      select: { counteragent_uuid: true, identification_number: true },
    }),
    getRequiredInsider(),
  ]);

  const counteragentMap = new Map<string, string>();
  for (const c of counteragents) {
    const inn = normalizeInn(c.identification_number ?? '');
    if (inn) counteragentMap.set(inn, c.counteragent_uuid);
  }

  const syncBatchId = randomUUID();
  const records = waybillArray.map((w) =>
    mapWaybillRecord(w, counteragentMap, insider.insiderUuid, syncBatchId),
  );

  // Resolve VAT payer status per seller TIN via is_vat_payer_tin.
  // The old CSV format encoded this as "-დღგ" suffix in the TIN string; SOAP does not include it.
  const sellerTins = new Set(records.map((r) => r.counteragent_inn).filter(Boolean) as string[]);
  const vatPayerMap = await batchIsVatPayerTin(credentials.su, credentials.sp, sellerTins);
  for (const r of records) {
    if (r.counteragent_inn && vatPayerMap.has(r.counteragent_inn)) {
      r.vat = vatPayerMap.get(r.counteragent_inn)!;
    }
  }

  const withKey = records.filter((r) => r.rs_id && r.waybill_no);
  const withoutKey = records.filter((r) => !(r.rs_id && r.waybill_no));

  const rsIds = withKey.map((r) => r.rs_id!);
  const waybillNos = withKey.map((r) => r.waybill_no!);

  // ---------------------------------------------------------------------------
  // Look up existing rs_waybills_in records to inherit user-editable fields.
  // Runs before rs_waybills_in_api upsert so new rows get user data seeded on creation.
  // ---------------------------------------------------------------------------
  const USER_FIELDS = ['project_uuid', 'financial_code_uuid', 'corresponding_account'] as const;
  const selectFields = Object.fromEntries(
    [...COMPARE_KEYS, ...USER_FIELDS, 'rs_id', 'waybill_no'].map((k) => [k, true]),
  ) as Record<string, true>;

  const [existingByRsId, existingByWaybillNoOnly] = await Promise.all([
    prisma.rs_waybills_in.findMany({
      where: { rs_id: { in: rsIds } },
      select: selectFields,
    }),
    // Old CSV records: have waybill_no but no rs_id yet
    prisma.rs_waybills_in.findMany({
      where: { waybill_no: { in: waybillNos }, rs_id: null },
      select: selectFields,
    }),
  ]);

  const rsIdMap = new Map(existingByRsId.map((r) => [r.rs_id as string, r as Record<string, unknown>]));
  const waybillNoMap = new Map(existingByWaybillNoOnly.map((r) => [r.waybill_no as string, r as Record<string, unknown>]));

  // Returns user-editable fields for a record by looking up rs_waybills_in.
  const findUserFields = (r: { rs_id: string | null; waybill_no: string | null }) => {
    const src = (r.rs_id ? rsIdMap.get(r.rs_id) : null) ?? (r.waybill_no ? waybillNoMap.get(r.waybill_no) : null);
    return {
      project_uuid: (src?.project_uuid as string | null) ?? null,
      financial_code_uuid: (src?.financial_code_uuid as string | null) ?? null,
      corresponding_account: (src?.corresponding_account as string | null) ?? null,
    };
  };

  // ---------------------------------------------------------------------------
  // 1. Upsert into rs_waybills_in_api — single source of truth.
  //    Creates: API fields + user fields seeded from rs_waybills_in.
  //    Updates: API fields only — user fields are never overwritten by sync.
  // ---------------------------------------------------------------------------
  if (withKey.length > 0) {
    const existingApiRsIds = new Set(
      (await prisma.rs_waybills_in_api.findMany({
        where: { rs_id: { in: rsIds } },
        select: { rs_id: true },
      })).map((r) => r.rs_id),
    );

    const apiCreate: typeof withKey = [];
    const apiUpdate: typeof withKey = [];
    for (const r of withKey) {
      (existingApiRsIds.has(r.rs_id!) ? apiUpdate : apiCreate).push(r);
    }

    // API-only fields — used for both creates and updates
    const toApiFields = (r: (typeof withKey)[0]) => ({
      rs_id: r.rs_id!,
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
      vat: r.vat,
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
        // Seed user fields from rs_waybills_in on first creation
        data: apiCreate.map((r) => ({ ...toApiFields(r), ...findUserFields(r) })),
        skipDuplicates: true,
      });
    }

    const updateBatchSizeApi = 50;
    for (let i = 0; i < apiUpdate.length; i += updateBatchSizeApi) {
      // Update API fields only — never touch user fields already in rs_waybills_in_api
      const batch = apiUpdate.slice(i, i + updateBatchSizeApi).map((r) =>
        prisma.rs_waybills_in_api.update({ where: { rs_id: r.rs_id! }, data: toApiFields(r) }),
      );
      await prisma.$transaction(batch);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Keep rs_waybills_in in sync for backward compatibility with existing UI.
  //    Primary lookup: by rs_id. Fallback: waybill_no with rs_id IS NULL (old CSV).
  // ---------------------------------------------------------------------------
  const toCreate = [...withoutKey];
  const toUpdate: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];

  for (const row of withKey) {
    const existingByRs = rsIdMap.get(row.rs_id!);
    if (existingByRs) {
      // Known record — update API fields only if something changed
      if (isDifferent(existingByRs, row as unknown as Record<string, unknown>, [...COMPARE_KEYS])) {
        const { project_uuid, financial_code_uuid, corresponding_account, created_at, updated_at, ...updatable } = row;
        toUpdate.push({
          where: { rs_id: row.rs_id!, waybill_no: row.waybill_no! },
          data: { ...updatable, import_batch_id: syncBatchId, updated_at: new Date() },
        });
      }
      continue;
    }

    const existingByNo = waybillNoMap.get(row.waybill_no!);
    if (existingByNo) {
      // Old CSV record — patch API fields + set rs_id, inherit user fields
      const { project_uuid, financial_code_uuid, corresponding_account, created_at, updated_at, ...updatable } = row;
      toUpdate.push({
        where: { waybill_no: row.waybill_no!, rs_id: null },
        data: { ...updatable, import_batch_id: syncBatchId, updated_at: new Date() },
      });
      continue;
    }

    toCreate.push(row);
  }

  const result = await prisma.rs_waybills_in.createMany({
    data: toCreate,
    skipDuplicates: true,
  });

  let updated = 0;
  const updateBatchSize = 50;
  for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
    const batch = toUpdate.slice(i, i + updateBatchSize).map((item) =>
      prisma.rs_waybills_in.updateMany({ where: item.where, data: item.data }),
    );
    await prisma.$transaction(batch);
    updated += batch.length;
  }

  return NextResponse.json({
    imported: result.count,
    updated,
    sync_batch_id: syncBatchId,
  });
}
