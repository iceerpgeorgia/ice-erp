// app/api/bank-transactions-test/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

const SOURCE_TABLES = [
  {
    name: "GE78BG0000000893486000_BOG_GEL",
    offset: 0,
    bankAccountUuid: null,
    accountCurrencyUuid: null,
    isTbc: false,
  },
  {
    name: "GE74BG0000000586388146_BOG_USD",
    offset: 300000000000,
    bankAccountUuid: null,
    accountCurrencyUuid: null,
    isTbc: false,
  },
  {
    name: "GE78BG0000000893486000_BOG_USD",
    offset: 500000000000,
    bankAccountUuid: null,
    accountCurrencyUuid: null,
    isTbc: false,
  },
  {
    name: "GE78BG0000000893486000_BOG_EUR",
    offset: 600000000000,
    bankAccountUuid: null,
    accountCurrencyUuid: null,
    isTbc: false,
  },
  {
    name: "GE78BG0000000893486000_BOG_AED",
    offset: 700000000000,
    bankAccountUuid: null,
    accountCurrencyUuid: null,
    isTbc: false,
  },
  {
    name: "GE78BG0000000893486000_BOG_GBP",
    offset: 800000000000,
    bankAccountUuid: null,
    accountCurrencyUuid: null,
    isTbc: false,
  },
  {
    name: "GE78BG0000000893486000_BOG_KZT",
    offset: 900000000000,
    bankAccountUuid: null,
    accountCurrencyUuid: null,
    isTbc: false,
  },
  {
    name: "GE78BG0000000893486000_BOG_CNY",
    offset: 950000000000,
    bankAccountUuid: null,
    accountCurrencyUuid: null,
    isTbc: false,
  },
  {
    name: "GE78BG0000000893486000_BOG_TRY",
    offset: 980000000000,
    bankAccountUuid: null,
    accountCurrencyUuid: null,
    isTbc: false,
  },
  {
    name: "GE65TB7856036050100002_TBC_GEL",
    offset: 1000000000000,
    bankAccountUuid: "1ef0f05d-00cc-4c6c-a858-4d8d50069496",
    accountCurrencyUuid: "5a2d799d-22a1-4e0a-b029-8031a1df6d56",
    isTbc: true,
  },
];

const BATCH_OFFSET = 2000000000000;

const BATCH_PAYMENT_ID_REGEX = /^BTC_[A-F0-9]{6}_[A-F0-9]{2}_[A-F0-9]{6}$/i;
const isBatchPaymentId = (value?: string | null) =>
  Boolean(value && BATCH_PAYMENT_ID_REGEX.test(value));

const UNION_SQL = SOURCE_TABLES.map((table) => {
  const baseAlias = table.isTbc ? 't' : 'cba';
  const conversionSelect = table.isTbc ? 'NULL::uuid as conversion_id' : `${baseAlias}.conversion_id`;
  const conversionFilter = table.isTbc ? '' : ` AND ${baseAlias}.conversion_id IS NULL`;
  const baseSelect = `SELECT
      ${baseAlias}.id,
      ${baseAlias}.uuid,
      ${baseAlias}.bank_account_uuid,
      ${baseAlias}.raw_record_uuid,
      ${baseAlias}.dockey,
      ${baseAlias}.entriesid,
      ${baseAlias}.transaction_date,
      ${baseAlias}.correction_date,
      ${baseAlias}.exchange_rate,
      ${conversionSelect},
      ${baseAlias}.description,
      ${baseAlias}.comment,
      ${baseAlias}.counteragent_uuid,
      ${baseAlias}.project_uuid,
      ${baseAlias}.financial_code_uuid,
      ${baseAlias}.account_currency_uuid,
      ${baseAlias}.account_currency_amount,
      ${baseAlias}.nominal_currency_uuid,
      ${baseAlias}.nominal_amount,
      ${baseAlias}.payment_id,
      ${baseAlias}.processing_case,
      ${baseAlias}.created_at,
      ${baseAlias}.updated_at,
      ${baseAlias}.counteragent_account_number,
      ${baseAlias}.parsing_lock,
      ${baseAlias}.applied_rule_id,
      ( ${baseAlias}.id + ${table.offset} )::bigint as synthetic_id,
      ${baseAlias}.id as source_id,
      '${table.name}' as source_table,
      NULL::bigint as batch_partition_id,
      NULL::numeric as batch_partition_amount,
      NULL::text as batch_payment_id,
      NULL::text as batch_payment_id_raw,
      NULL::text as batch_id,
      NULL::uuid as batch_counteragent_uuid,
      NULL::uuid as batch_project_uuid,
      NULL::uuid as batch_financial_code_uuid,
      NULL::uuid as batch_nominal_currency_uuid,
      NULL::numeric as batch_nominal_amount
    FROM "${table.name}" ${baseAlias}
    WHERE NOT EXISTS (
      SELECT 1 FROM bank_transaction_batches btb
      WHERE btb.raw_record_uuid::text = ${baseAlias}.raw_record_uuid::text
    )${conversionFilter}`;

  const batchSelect = `SELECT
      ${baseAlias}.id,
      ${baseAlias}.uuid,
      ${baseAlias}.bank_account_uuid,
      ${baseAlias}.raw_record_uuid,
      ${baseAlias}.dockey,
      ${baseAlias}.entriesid,
      ${baseAlias}.transaction_date,
      ${baseAlias}.correction_date,
      ${baseAlias}.exchange_rate,
      ${conversionSelect},
      ${baseAlias}.description,
      ${baseAlias}.comment,
      ${baseAlias}.counteragent_uuid,
      ${baseAlias}.project_uuid,
      ${baseAlias}.financial_code_uuid,
      ${baseAlias}.account_currency_uuid,
      ${baseAlias}.account_currency_amount,
      ${baseAlias}.nominal_currency_uuid,
      ${baseAlias}.nominal_amount,
      ${baseAlias}.payment_id,
      ${baseAlias}.processing_case,
      ${baseAlias}.created_at,
      ${baseAlias}.updated_at,
      ${baseAlias}.counteragent_account_number,
      ${baseAlias}.parsing_lock,
      ${baseAlias}.applied_rule_id,
      ( btb.id + ${BATCH_OFFSET} + ${table.offset} )::bigint as synthetic_id,
      ${baseAlias}.id as source_id,
      '${table.name}' as source_table,
      btb.id as batch_partition_id,
      (btb.partition_amount * CASE WHEN ${baseAlias}.account_currency_amount < 0 THEN -1 ELSE 1 END) as batch_partition_amount,
      COALESCE(
        CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
        p.payment_id
      ) as batch_payment_id,
      btb.payment_id as batch_payment_id_raw,
      btb.batch_id as batch_id,
      COALESCE(btb.counteragent_uuid, p.counteragent_uuid) as batch_counteragent_uuid,
      COALESCE(btb.project_uuid, p.project_uuid) as batch_project_uuid,
      COALESCE(btb.financial_code_uuid, p.financial_code_uuid) as batch_financial_code_uuid,
      COALESCE(btb.nominal_currency_uuid, p.currency_uuid) as batch_nominal_currency_uuid,
      (btb.nominal_amount * CASE WHEN ${baseAlias}.account_currency_amount < 0 THEN -1 ELSE 1 END) as batch_nominal_amount
    FROM "${table.name}" ${baseAlias}
    JOIN bank_transaction_batches btb
      ON btb.raw_record_uuid::text = ${baseAlias}.raw_record_uuid::text
    LEFT JOIN payments p
      ON (
        btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
      ) OR (
        btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
      )${conversionFilter}`;

  return `${baseSelect} UNION ALL ${batchSelect}`;
}).join(' UNION ALL ');

const UNFETCHED_UNION_SQL = SOURCE_TABLES.map((table) => {
  const baseAlias = table.isTbc ? 't' : 'cba';
  const conversionFilter = table.isTbc ? '' : ` AND ${baseAlias}.conversion_id IS NULL`;
  const baseSelect = `SELECT
      ( ${baseAlias}.id + ${table.offset} )::bigint as synthetic_id,
      ${baseAlias}.account_currency_uuid,
      ${baseAlias}.account_currency_amount
    FROM "${table.name}" ${baseAlias}
    WHERE NOT EXISTS (
      SELECT 1 FROM bank_transaction_batches btb
      WHERE btb.raw_record_uuid::text = ${baseAlias}.raw_record_uuid::text
    )${conversionFilter}`;
  const batchSelect = `SELECT
      ( btb.id + ${BATCH_OFFSET} + ${table.offset} )::bigint as synthetic_id,
      ${baseAlias}.account_currency_uuid,
      (btb.partition_amount * CASE WHEN ${baseAlias}.account_currency_amount < 0 THEN -1 ELSE 1 END) as account_currency_amount
    FROM "${table.name}" ${baseAlias}
    JOIN bank_transaction_batches btb
      ON btb.raw_record_uuid::text = ${baseAlias}.raw_record_uuid::text${conversionFilter}`;
  return `${baseSelect} UNION ALL ${batchSelect}`;
}).join(' UNION ALL ');

// Map raw SQL results (snake_case) to API response (snake_case)
function toApi(row: any) {
  const hasBatch = row.batch_partition_id !== null && row.batch_partition_id !== undefined;
  const paymentId = hasBatch ? row.batch_payment_id ?? null : row.payment_id ?? null;
  const hasBatchIdAsPayment = isBatchPaymentId(paymentId);
  const batchId = row.batch_id ?? (
    isBatchPaymentId(row.payment_id)
      ? row.payment_id
      : (isBatchPaymentId(row.batch_payment_id_raw) ? row.batch_payment_id_raw : null)
  );
  const counteragentUuid = hasBatch ? row.batch_counteragent_uuid : row.counteragent_uuid;
  const projectUuid = hasBatch ? row.batch_project_uuid : row.project_uuid;
  const financialCodeUuid = hasBatch ? row.batch_financial_code_uuid : row.financial_code_uuid;
  const nominalCurrencyUuid = hasBatch ? row.batch_nominal_currency_uuid : row.nominal_currency_uuid;
  const nominalAmount = hasBatch
    ? (row.batch_nominal_amount ? Number(row.batch_nominal_amount) : null)
    : (row.nominal_amount ? Number(row.nominal_amount) : null);
  return {
    id: Number(row.synthetic_id ?? row.id),
    source_table: row.source_table ?? null,
    source_id: row.source_id ?? row.id ?? null,
    uuid: row.uuid,
    bank_account_uuid: row.bank_account_uuid,
    raw_record_uuid: row.raw_record_uuid,
    dockey: row.dockey ?? null,
    entriesid: row.entriesid ?? null,
    transaction_date: row.transaction_date,
    correction_date: row.correction_date || null,
    exchange_rate: row.exchange_rate ? Number(row.exchange_rate) : null,
    description: row.description,
    comment: row.comment ?? null,
    counteragent_uuid: hasBatchIdAsPayment ? null : counteragentUuid,
    counteragent_account_number: row.counteragent_account_number ? String(row.counteragent_account_number) : null,
    project_uuid: hasBatchIdAsPayment ? null : projectUuid,
    financial_code_uuid: hasBatchIdAsPayment ? null : financialCodeUuid,
    account_currency_uuid: row.account_currency_uuid,
    account_currency_amount: hasBatch
      ? (row.batch_partition_amount ? Number(row.batch_partition_amount) : null)
      : (row.account_currency_amount ? Number(row.account_currency_amount) : null),
    nominal_currency_uuid: hasBatchIdAsPayment ? null : nominalCurrencyUuid,
    nominal_amount: hasBatchIdAsPayment ? null : nominalAmount,
    payment_id: hasBatchIdAsPayment ? null : paymentId,
    batch_id: batchId ?? null,
    batch_partition_id: hasBatch ? Number(row.batch_partition_id) : null,
    is_batch: hasBatch,
    parsing_lock: hasBatch ? true : (row.parsing_lock ?? false),
    processing_case: row.processing_case,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    applied_rule_id: row.applied_rule_id ?? null,
    is_balance_record: false,

    // Join data from raw SQL
    account_number: row.account_number ?? null,
    bank_name: row.bank_name ?? null,
    counteragent_name: null,
    project_index: null,
    financial_code: null,
  };
}

// Map balance records from bank_accounts table to transaction format
function balanceToApi(row: any, currencyCode: string) {
  const balanceDate = row.balance_date
    ? new Date(row.balance_date).toLocaleDateString('en-GB').split('/').join('.')
    : null;

  return {
    id: Number(row.id) * -1,
    uuid: `balance-${row.uuid}`,
    bank_account_uuid: row.uuid,
    raw_record_uuid: null,
    transaction_date: balanceDate,
    description: 'Balance Depiction',
    comment: null,
    counteragent_uuid: null,
    counteragent_account_number: `${row.accountNumber}${currencyCode}`,
    project_uuid: null,
    financial_code_uuid: null,
    account_currency_uuid: row.currencyUuid,
    account_currency_amount: row.balance?.toString() ?? null,
    nominal_currency_uuid: row.currencyUuid,
    nominal_amount: row.balance?.toString() ?? null,
    processing_case: null,
    createdAt: null,
    updatedAt: null,
    applied_rule_id: null,
    batch_partition_id: null,
    is_batch: false,
    is_balance_record: true,

    // Join data
    account_number: row.accountNumber && currencyCode ? `${row.accountNumber}${currencyCode}` : row.accountNumber,
    bank_name: row.bank?.bankName ?? null,
    counteragent_name: null,
    project_index: null,
    financial_code: null,
    nominal_currency_code: currencyCode,
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const idsParam = searchParams.get('ids');
    const rawRecordUuid = searchParams.get('rawRecordUuid');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    console.log('[API] Query params:', { fromDate, toDate, idsParam, rawRecordUuid, limitParam, offsetParam });

    const toComparableDate = (dateStr: string | null): string | null => {
      if (!dateStr || dateStr.length < 10) return null;
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length < 3) return null;
        const [year, month, day] = parts;
        if (!year || !month || !day) return null;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      const parts = dateStr.split('.');
      if (parts.length !== 3) return null;
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };

    const normalizeRateDate = (value: any): string | null => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
        const comparable = toComparableDate(trimmed);
        return comparable;
      }
      return null;
    };

    if (idsParam) {
      console.log('[API] Fetching specific IDs:', idsParam.split(',').map(id => id.trim()));
    }

    const fromComparable = toComparableDate(fromDate);
    const toComparable = toComparableDate(toDate);
    const dateFilterEnabled = Boolean((fromComparable || toComparable) && !idsParam && !rawRecordUuid);

    const defaultLimit = 1000;
    const parsedLimit = limitParam && limitParam !== '0' ? Number.parseInt(limitParam, 10) : undefined;
    const limitRequested = limitParam === '0'
      ? 0
      : (Number.isNaN(parsedLimit) ? undefined : parsedLimit);
    let limit = idsParam || rawRecordUuid
      ? undefined
      : (limitRequested === 0 ? undefined : (limitRequested ?? defaultLimit));
    const offset = offsetParam ? parseInt(offsetParam) : 0;

    if (limit && limit > 5000) {
      console.warn('[API] ⚠️ Large limit requested:', limit, '- this may be slow. Consider pagination.');
    }

    console.log('[API] Fetch params:', { limit, offset, hasIds: !!idsParam });

    console.log('[API] Step 1: Fetching transactions with JOINs...');
    let transactions: any[];

    if (rawRecordUuid) {
      transactions = await prisma.$queryRawUnsafe<any[]>(
        `SELECT 
           cba.*,
           ba.account_number,
           b.bank_name,
           ca.counteragent as counteragent_name,
           p.project_index,
           fc.validation as financial_code,
           curr_acc.code as account_currency_code,
           curr_nom.code as nominal_currency_code
         FROM (${UNION_SQL}) cba
         LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
         LEFT JOIN banks b ON ba.bank_uuid = b.uuid
         LEFT JOIN counteragents ca ON COALESCE(cba.batch_counteragent_uuid, cba.counteragent_uuid) = ca.counteragent_uuid
         LEFT JOIN projects p ON COALESCE(cba.batch_project_uuid, cba.project_uuid) = p.project_uuid
         LEFT JOIN financial_codes fc ON COALESCE(cba.batch_financial_code_uuid, cba.financial_code_uuid) = fc.uuid
         LEFT JOIN currencies curr_acc ON cba.account_currency_uuid = curr_acc.uuid
         LEFT JOIN currencies curr_nom ON cba.nominal_currency_uuid = curr_nom.uuid
         WHERE cba.raw_record_uuid::text = $1::text
         ORDER BY cba.transaction_date DESC, cba.id DESC`,
        rawRecordUuid
      );
    } else if (idsParam) {
      const idsArray = idsParam.split(',').map(id => id.trim());
      transactions = await prisma.$queryRawUnsafe<any[]>(
        `SELECT 
           cba.*,
           ba.account_number,
           b.bank_name,
           ca.counteragent as counteragent_name,
           p.project_index,
           fc.validation as financial_code,
           curr_acc.code as account_currency_code,
           curr_nom.code as nominal_currency_code
         FROM (${UNION_SQL}) cba
         LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
         LEFT JOIN banks b ON ba.bank_uuid = b.uuid
         LEFT JOIN counteragents ca ON COALESCE(cba.batch_counteragent_uuid, cba.counteragent_uuid) = ca.counteragent_uuid
         LEFT JOIN projects p ON COALESCE(cba.batch_project_uuid, cba.project_uuid) = p.project_uuid
         LEFT JOIN financial_codes fc ON COALESCE(cba.batch_financial_code_uuid, cba.financial_code_uuid) = fc.uuid
         LEFT JOIN currencies curr_acc ON cba.account_currency_uuid = curr_acc.uuid
         LEFT JOIN currencies curr_nom ON cba.nominal_currency_uuid = curr_nom.uuid
         WHERE cba.synthetic_id = ANY($1::bigint[])
         ORDER BY cba.transaction_date DESC, cba.id DESC`,
        idsArray
      );
    } else {
      const limitSql = typeof limit === 'number' ? ` LIMIT ${limit} OFFSET ${offset || 0}` : '';
      const dateFilters: string[] = [];
      const params: any[] = [];
      const txDateExpr = `CASE
        WHEN cba.transaction_date LIKE '%.%' THEN to_date(cba.transaction_date, 'DD.MM.YYYY')
        WHEN cba.transaction_date LIKE '____-__-__%' THEN to_date(substr(cba.transaction_date, 1, 10), 'YYYY-MM-DD')
        ELSE NULL
      END`;

      if (fromComparable) {
        params.push(fromComparable);
        dateFilters.push(`${txDateExpr} >= to_date($${params.length}, 'YYYY-MM-DD')`);
      }
      if (toComparable) {
        params.push(toComparable);
        dateFilters.push(`${txDateExpr} <= to_date($${params.length}, 'YYYY-MM-DD')`);
      }

      const whereSql = dateFilters.length ? ` WHERE ${dateFilters.join(' AND ')}` : '';

      transactions = await prisma.$queryRawUnsafe<any[]>(
        `SELECT 
           cba.*,
           ba.account_number,
           b.bank_name,
           ca.counteragent as counteragent_name,
           p.project_index,
           fc.validation as financial_code,
           curr_acc.code as account_currency_code,
           curr_nom.code as nominal_currency_code
         FROM (${UNION_SQL}) cba
         LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
         LEFT JOIN banks b ON ba.bank_uuid = b.uuid
         LEFT JOIN counteragents ca ON COALESCE(cba.batch_counteragent_uuid, cba.counteragent_uuid) = ca.counteragent_uuid
         LEFT JOIN projects p ON COALESCE(cba.batch_project_uuid, cba.project_uuid) = p.project_uuid
         LEFT JOIN financial_codes fc ON COALESCE(cba.batch_financial_code_uuid, cba.financial_code_uuid) = fc.uuid
         LEFT JOIN currencies curr_acc ON cba.account_currency_uuid = curr_acc.uuid
         LEFT JOIN currencies curr_nom ON cba.nominal_currency_uuid = curr_nom.uuid
         ${whereSql}
         ORDER BY cba.transaction_date DESC, cba.id DESC${limitSql}`,
        ...params
      );
    }

    console.log('[API] Step 1 complete: Got', transactions.length, 'transactions with all joins');

    console.log('[API] Step 2: Getting total count...');
    const totalCount = idsParam || rawRecordUuid || dateFilterEnabled || typeof limit !== 'number'
      ? undefined
      : (await prisma.$queryRawUnsafe<Array<{count: bigint}>>(
          `SELECT SUM(count)::bigint as count FROM (
            ${SOURCE_TABLES.map(table => `SELECT COUNT(*)::bigint as count FROM "${table.name}"`).join(' UNION ALL ')}
          ) counts`
        ))[0].count;
    console.log('[API] Step 2 complete: Total count =', totalCount);

    console.log('[API] Step 3: Filtering transactions by date...');
    let filteredTransactions = transactions;
    if ((fromDate || toDate) && !idsParam && !dateFilterEnabled) {
      console.log('[API] Comparable dates:', { fromComparable, toComparable });

      filteredTransactions = transactions.filter(t => {
        const txDateComparable = toComparableDate(t.transaction_date);
        if (!txDateComparable) return true;

        if (fromComparable && txDateComparable < fromComparable) return false;
        if (toComparable && txDateComparable > toComparable) return false;
        return true;
      });

      console.log('[API] Filtered from', transactions.length, 'to', filteredTransactions.length, 'records');
    }
    console.log('[API] Step 3 complete: Filtered count =', filteredTransactions.length);

    console.log('[API] Step 3b: Loading conversion transactions...');
    let conversionRows: any[] = [];
    let conversionSummaryRows: Array<{ account_currency_uuid: string; account_currency_amount: number }> = [];
    let conversionOutsideSummary: Array<{ account_currency_uuid: string; account_currency_amount: number }> = [];

    if (!idsParam && !rawRecordUuid) {
      const conversionIdBase = 3000000000000;
      const conversionEntries = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
           (ce.id + ${conversionIdBase})::bigint as synthetic_id,
           ce.id,
           ce.conversion_id,
           ce.conversion_uuid,
           ce.entry_type,
           ce.bank_account_uuid,
           ce.raw_record_uuid,
           ce.dockey,
           ce.entriesid,
           ce.transaction_date,
           ce.correction_date,
           ce.exchange_rate,
           ce.description,
           ce.comment,
           ce.counteragent_uuid,
           ce.counteragent_account_number,
           ce.project_uuid,
           ce.financial_code_uuid,
           ce.account_currency_uuid,
           ce.account_currency_amount,
           ce.nominal_currency_uuid,
           ce.nominal_amount,
           ce.payment_id,
           ce.processing_case,
           ce.created_at,
           ce.updated_at,
           ce.parsing_lock,
           ce.applied_rule_id,
           ce.batch_id,
           ce.account_number,
           ce.bank_name,
           ce.account_currency_code,
           ce.nominal_currency_code,
           ce.usd_gel_rate,
           ce.counteragent_name,
           ce.financial_code,
           ce.project_index,
           ce.source_table
         FROM conversion_entries ce
         ORDER BY ce.transaction_date DESC, ce.id DESC`
      );

      const conversionFiltered = (fromComparable || toComparable)
        ? conversionEntries.filter((row) => {
            const comparable = toComparableDate(row.transaction_date ?? null);
            if (!comparable) return false;
            if (fromComparable && comparable < fromComparable) return false;
            if (toComparable && comparable > toComparable) return false;
            return true;
          })
        : conversionEntries;

      const conversionOutside = (fromComparable || toComparable)
        ? conversionEntries.filter((row) => {
            const comparable = toComparableDate(row.transaction_date ?? null);
            if (!comparable) return false;
            if (fromComparable && comparable < fromComparable) return true;
            if (toComparable && comparable > toComparable) return true;
            return false;
          })
        : [];

      conversionRows = conversionFiltered.map((row) => ({
        id: Number(row.synthetic_id ?? row.id),
        source_table: row.source_table ?? 'conversion_entries',
        source_id: row.conversion_id ?? row.id ?? null,
        uuid: row.conversion_uuid ?? null,
        bank_account_uuid: row.bank_account_uuid,
        raw_record_uuid: row.raw_record_uuid ?? null,
        dockey: row.dockey ?? null,
        entriesid: row.entriesid ?? null,
        transaction_date: row.transaction_date ?? null,
        correction_date: row.correction_date ?? null,
        exchange_rate: row.exchange_rate ? Number(row.exchange_rate) : null,
        description: row.description ?? null,
        comment: row.comment ?? null,
        counteragent_uuid: row.counteragent_uuid ?? null,
        counteragent_account_number: row.counteragent_account_number ? String(row.counteragent_account_number) : null,
        project_uuid: row.project_uuid ?? null,
        financial_code_uuid: row.financial_code_uuid ?? null,
        account_currency_uuid: row.account_currency_uuid ?? null,
        account_currency_amount: row.account_currency_amount ? Number(row.account_currency_amount) : null,
        nominal_currency_uuid: row.nominal_currency_uuid ?? null,
        nominal_amount: row.nominal_amount ? Number(row.nominal_amount) : null,
        payment_id: row.payment_id ?? null,
        processing_case: row.processing_case ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        parsing_lock: row.parsing_lock ?? false,
        applied_rule_id: row.applied_rule_id ?? null,
        batch_id: row.batch_id ?? null,
        batch_partition_id: null,
        is_batch: false,
        is_balance_record: false,
        account_number: row.account_number ?? null,
        bank_name: row.bank_name ?? null,
        counteragent_name: row.counteragent_name ?? null,
        project_index: row.project_index ?? null,
        financial_code: row.financial_code ?? null,
        account_currency_code: row.account_currency_code ?? null,
        nominal_currency_code: row.nominal_currency_code ?? null,
        usd_gel_rate: row.usd_gel_rate ? Number(row.usd_gel_rate) : null,
      }));

      conversionSummaryRows = conversionRows.map((row) => ({
        account_currency_uuid: row.account_currency_uuid,
        account_currency_amount: Number(row.account_currency_amount || 0),
      }));

      conversionOutsideSummary = conversionOutside.map((row) => ({
        account_currency_uuid: row.account_currency_uuid,
        account_currency_amount: Number(row.account_currency_amount || 0),
      }));
    }

    console.log('[API] Step 4: Fetching balance records...');
    const balanceRecords = await prisma.bankAccount.findMany({
      where: {
        balance: { not: null },
        balanceDate: { not: null },
        isActive: true
      },
      include: {
        bank: true,
        currency: true
      }
    });
    console.log('[API] Step 4 complete: Got', balanceRecords.length, 'balance records');

    const rateDates = new Set<string>();
    for (const tx of filteredTransactions) {
      const rateDate = normalizeRateDate(tx.correction_date || tx.transaction_date);
      if (rateDate) rateDates.add(rateDate);
    }
    for (const balance of balanceRecords) {
      const rateDate = normalizeRateDate(balance.balanceDate);
      if (rateDate) rateDates.add(rateDate);
    }

    const rateDateList = Array.from(rateDates);
    const rateRows = rateDateList.length > 0
      ? await prisma.nbg_exchange_rates.findMany({
          where: {
            date: {
              in: rateDateList.map(dateStr => new Date(dateStr))
            }
          },
          select: { date: true, usd_rate: true }
        })
      : [];

    const rateMap = new Map<string, number | null>();
    for (const rateRow of rateRows) {
      const key = rateRow.date instanceof Date
        ? rateRow.date.toISOString().slice(0, 10)
        : new Date(rateRow.date as any).toISOString().slice(0, 10);
      rateMap.set(key, rateRow.usd_rate ? Number(rateRow.usd_rate) : null);
    }

    const getUsdGelRate = (value: any): number | null => {
      const dateKey = normalizeRateDate(value);
      if (!dateKey) return null;
      return rateMap.get(dateKey) ?? null;
    };

    if (conversionRows.length > 0) {
      conversionRows = conversionRows.map((row) => ({
        ...row,
        usd_gel_rate: getUsdGelRate(row.correction_date || row.transaction_date),
      }));
    }

    const result = filteredTransactions.map(row => {
      const base = toApi(row);
      const accountCurrencyCode = row.account_currency_code ?? null;
      const nominalCurrencyCode = row.nominal_currency_code ?? null;
      const accountNumber = row.account_number ?? null;
      const usdGelRate = getUsdGelRate(row.correction_date || row.transaction_date);

      return {
        ...base,
        counteragent_name: row.counteragent_name ?? null,
        project_index: row.project_index ?? null,
        financial_code: row.financial_code ?? null,
        account_number: accountNumber && accountCurrencyCode ? `${accountNumber}${accountCurrencyCode}` : accountNumber,
        nominal_currency_code: nominalCurrencyCode,
        usd_gel_rate: usdGelRate,
      };
    });

    const balanceResults = balanceRecords
      .map(row => ({
        ...balanceToApi(row, row.currency?.code ?? ''),
        usd_gel_rate: getUsdGelRate(row.balanceDate)
      }))
      .filter(balanceRecord => {
        if (!fromDate && !toDate) return true;
        const balanceDateComparable = toComparableDate(balanceRecord.transaction_date);
        if (!balanceDateComparable) return false;

        const fromComparable = toComparableDate(fromDate);
        const toComparable = toComparableDate(toDate);

        if (fromComparable && balanceDateComparable < fromComparable) return false;
        if (toComparable && balanceDateComparable > toComparable) return false;
        return true;
      });

    const combinedResult = [...result, ...conversionRows, ...balanceResults];

    const currencySummaries: Record<string, any> = {};

    const fetchedIdsArray = Array.from(
      new Set(
        [...filteredTransactions.map(t => t.id), ...conversionRows.map(r => r.id)]
          .filter(id => id !== null && id !== undefined)
          .map(id => String(id))
          .filter(id => /^\d+$/.test(id))
      )
    );
    let unfetchedTransactions: Array<{account_currency_uuid: string, account_currency_amount: any}>;

    if (fetchedIdsArray.length > 0) {
      const idsString = fetchedIdsArray.join(',');
      unfetchedTransactions = await prisma.$queryRawUnsafe<Array<{account_currency_uuid: string, account_currency_amount: any}>>(
        `SELECT account_currency_uuid, account_currency_amount 
         FROM (${UNFETCHED_UNION_SQL}) cba
         WHERE cba.synthetic_id NOT IN (${idsString})`
      );
    } else {
      unfetchedTransactions = await prisma.$queryRawUnsafe<Array<{account_currency_uuid: string, account_currency_amount: any}>>(
        `SELECT account_currency_uuid, account_currency_amount FROM (${UNFETCHED_UNION_SQL}) cba`
      );
    }

    console.log('[API] Fetched transaction IDs count:', fetchedIdsArray.length);
    console.log('[API] Unfetched transactions count:', unfetchedTransactions.length);

    const openingByCurrency: Record<string, number> = {};
    for (const tx of unfetchedTransactions) {
      if (tx.account_currency_uuid && tx.account_currency_amount) {
        const currencyUuid = tx.account_currency_uuid;
        const amount = Number(tx.account_currency_amount);
        if (!isNaN(amount)) {
          openingByCurrency[currencyUuid] = (openingByCurrency[currencyUuid] || 0) + amount;
        }
      }
    }

    if ((fromDate || toDate) && conversionOutsideSummary.length > 0) {
      for (const tx of conversionOutsideSummary) {
        if (tx.account_currency_uuid) {
          const amount = Number(tx.account_currency_amount);
          if (!isNaN(amount)) {
            openingByCurrency[tx.account_currency_uuid] = (openingByCurrency[tx.account_currency_uuid] || 0) + amount;
          }
        }
      }
    }

    const bankAccountBalances = await prisma.bankAccount.findMany({
      where: {
        balance: { not: null },
        isActive: true
      },
      select: {
        currencyUuid: true,
        balance: true
      }
    });

    for (const account of bankAccountBalances) {
      const currencyUuid = account.currencyUuid;
      const balance = account.balance ? parseFloat(account.balance.toString()) : 0;
      if (currencyUuid) {
        openingByCurrency[currencyUuid] = (openingByCurrency[currencyUuid] || 0) + balance;
      }
    }

    console.log('[API] Opening balances by currency:', openingByCurrency);

    console.log('[API] Step 5: Calculating inflow/outflow...');
    const inflowByCurrency: Record<string, number> = {};
    const outflowByCurrency: Record<string, number> = {};

    for (const tx of [...filteredTransactions, ...conversionSummaryRows]) {
      const currencyUuid = tx.account_currency_uuid;
      const amount = tx.account_currency_amount ? Number(tx.account_currency_amount) : 0;

      if (currencyUuid && !isNaN(amount)) {
        if (amount > 0) {
          inflowByCurrency[currencyUuid] = (inflowByCurrency[currencyUuid] || 0) + amount;
        } else if (amount < 0) {
          outflowByCurrency[currencyUuid] = (outflowByCurrency[currencyUuid] || 0) + Math.abs(amount);
        }
      }
    }
    console.log('[API] Step 5 complete');

    const allCurrencyUuids = new Set([
      ...Object.keys(openingByCurrency),
      ...Object.keys(inflowByCurrency),
      ...Object.keys(outflowByCurrency)
    ]);

    const currenciesToFetch = Array.from(allCurrencyUuids);
    const currencyData = currenciesToFetch.length > 0
      ? await prisma.currencies.findMany({
          where: { uuid: { in: currenciesToFetch } },
          select: { uuid: true, code: true }
        })
      : [];
    const currencyMap = new Map(currencyData.map(c => [c.uuid, c.code]));

    for (const currencyUuid of allCurrencyUuids) {
      const openingBalance = openingByCurrency[currencyUuid] || 0;
      const inflow = inflowByCurrency[currencyUuid] || 0;
      const outflow = outflowByCurrency[currencyUuid] || 0;
      const closingBalance = openingBalance + inflow - outflow;
      const currencyCode = currencyMap.get(currencyUuid) || 'Unknown';

      currencySummaries[currencyCode] = {
        currency_code: currencyCode,
        opening_balance: openingBalance.toFixed(2),
        inflow: inflow.toFixed(2),
        outflow: outflow.toFixed(2),
        closing_balance: closingBalance.toFixed(2)
      };
    }

    console.log('[API] Step 6: Building response...');
    console.log('[API] - combinedResult length:', combinedResult.length);
    console.log('[API] - totalCount:', totalCount);

    const sanitizeBigInt = (value: any): any => {
      if (typeof value === 'bigint') return value.toString();
      if (Array.isArray(value)) return value.map(sanitizeBigInt);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeBigInt(v)]));
      }
      return value;
    };

    return NextResponse.json(
      sanitizeBigInt({
        data: combinedResult,
        currency_summaries: Object.values(currencySummaries),
        pagination: totalCount !== undefined ? {
          total: Number(totalCount),
          limit: limit ?? combinedResult.length,
          offset: offset,
          hasMore: Number(totalCount) > (offset + (limit ?? 0))
        } : undefined
      })
    );
  } catch (error: any) {
    console.error("[GET /api/bank-transactions-test] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch bank transactions" },
      { status: 500 }
    );
  }
}
