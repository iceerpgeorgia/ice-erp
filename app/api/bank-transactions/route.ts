// app/api/bank-transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractPaymentID } from "@/lib/bank-import/db-utils";

export const revalidate = 0;

const SOURCE_TABLES = [
  {
    name: "GE78BG0000000893486000_BOG_GEL",
    offset: 0,
    isTbc: false,
  },
  {
    name: "GE78BG0000000893486000_BOG_USD",
    offset: 500000000000,
    isTbc: false,
  },
  {
    name: "GE65TB7856036050100002_TBC_GEL",
    offset: 1000000000000,
    isTbc: true,
  },
];

const BATCH_OFFSET = 2000000000000;

const BATCH_PAYMENT_ID_REGEX = /^BTC_[A-F0-9]{6}_[A-F0-9]{2}_[A-F0-9]{6}$/i;
const isBatchPaymentId = (value?: string | null) =>
  Boolean(value && BATCH_PAYMENT_ID_REGEX.test(value));

const UNION_SQL = SOURCE_TABLES.map((table) => {
  const baseAlias = table.isTbc ? 't' : 'cba';
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
      ${baseAlias}.description,
      ${baseAlias}.comment,
      ${baseAlias}.docinformation,
      ${baseAlias}.docnomination,
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
    )`;

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
      ${baseAlias}.description,
      ${baseAlias}.comment,
      ${baseAlias}.docinformation,
      ${baseAlias}.docnomination,
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
      )`;

  return `${baseSelect} UNION ALL ${batchSelect}`;
}).join(' UNION ALL ');

const UNFETCHED_UNION_SQL = SOURCE_TABLES.map((table) => {
  const baseAlias = table.isTbc ? 't' : 'cba';
  const baseSelect = `SELECT
      ( ${baseAlias}.id + ${table.offset} )::bigint as synthetic_id,
      ${baseAlias}.account_currency_uuid,
      ${baseAlias}.account_currency_amount
    FROM "${table.name}" ${baseAlias}
    WHERE NOT EXISTS (
      SELECT 1 FROM bank_transaction_batches btb
      WHERE btb.raw_record_uuid::text = ${baseAlias}.raw_record_uuid::text
    )`;
  const batchSelect = `SELECT
      ( btb.id + ${BATCH_OFFSET} + ${table.offset} )::bigint as synthetic_id,
      ${baseAlias}.account_currency_uuid,
      (btb.partition_amount * CASE WHEN ${baseAlias}.account_currency_amount < 0 THEN -1 ELSE 1 END) as account_currency_amount
    FROM "${table.name}" ${baseAlias}
    JOIN bank_transaction_batches btb
      ON btb.raw_record_uuid::text = ${baseAlias}.raw_record_uuid::text`;
  return `${baseSelect} UNION ALL ${batchSelect}`;
}).join(' UNION ALL ');

// Map raw SQL results (snake_case) to API response (snake_case)
function toApi(row: any) {
  const fallbackPaymentId =
    row.payment_id || extractPaymentID(row.docinformation || row.docnomination);
  const hasBatch = row.batch_partition_id !== null && row.batch_partition_id !== undefined;
  const paymentId = hasBatch ? row.batch_payment_id : fallbackPaymentId;
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
    source_id: row.source_id !== undefined && row.source_id !== null
      ? Number(row.source_id)
      : (row.id !== undefined && row.id !== null ? Number(row.id) : null),
    uuid: row.uuid,
    bank_account_uuid: row.bank_account_uuid,
    raw_record_uuid: row.raw_record_uuid,
    dockey: row.dockey ?? null,
    entriesid: row.entriesid ?? null,
    transaction_date: row.transaction_date,
    correction_date: row.correction_date || null, // NEW COLUMN
    exchange_rate: row.exchange_rate ? Number(row.exchange_rate) : null, // NEW COLUMN
    nominal_exchange_rate: row.nominal_exchange_rate ? Number(row.nominal_exchange_rate) : null,
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
    payment_id: hasBatchIdAsPayment ? null : (paymentId ?? null),
    batch_id: batchId ?? null,
    batch_partition_id: hasBatch ? Number(row.batch_partition_id) : null,
    is_batch: hasBatch,
    parsing_lock: hasBatch ? true : (row.parsing_lock ?? false),
    processing_case: row.processing_case,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    is_balance_record: false, // Regular transaction
    
    // Join data from raw SQL
    account_number: row.account_number ?? null,
    bank_name: row.bank_name ?? null,
    counteragent_name: null, // Will be populated by separate query
    project_index: null, // Will be populated by separate query
    financial_code: null, // Will be populated by separate query
  };
}

// Map balance records from bank_accounts table to transaction format
function balanceToApi(row: any, currencyCode: string) {
  const balanceDate = row.balance_date ? 
    new Date(row.balance_date).toLocaleDateString('en-GB').split('/').join('.') : // dd.mm.yyyy
    null;
  
  return {
    id: Number(row.id) * -1, // Negative ID to distinguish from real transactions
    uuid: `balance-${row.uuid}`, // Prefix to distinguish from real UUIDs
    bank_account_uuid: row.uuid,
    raw_record_uuid: null,
    transaction_date: balanceDate,
    description: 'Balance Depiction',
    comment: null,
    counteragent_uuid: null,
    counteragent_account_number: `${row.accountNumber}${currencyCode}`, // Account number + currency
    project_uuid: null,
    financial_code_uuid: null,
    account_currency_uuid: row.currencyUuid,
    account_currency_amount: row.balance?.toString() ?? null,
    nominal_currency_uuid: row.currencyUuid,
    nominal_amount: row.balance?.toString() ?? null,
    nominal_exchange_rate: null,
    processing_case: null,
    batch_partition_id: null,
    is_batch: false,
    createdAt: null,
    updatedAt: null,
    is_balance_record: true, // Flag to disable view/edit actions
    applied_rule_id: null,
    
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
    // Parse query parameters for date filtering and ID filtering
    const searchParams = req.nextUrl.searchParams;
    const fromDate = searchParams.get('fromDate'); // dd.mm.yyyy format
    const toDate = searchParams.get('toDate');     // dd.mm.yyyy format
    const idsParam = searchParams.get('ids');      // Comma-separated IDs for fetching specific records
    const rawRecordUuid = searchParams.get('rawRecordUuid');
    const limitParam = searchParams.get('limit');  // Optional limit override (default: 1000)
    const offsetParam = searchParams.get('offset'); // Optional offset for pagination (default: 0)
    
    console.log('[API] Query params:', { fromDate, toDate, idsParam, rawRecordUuid, limitParam, offsetParam });
    
    // Helper to convert dd.mm.yyyy or yyyy-mm-dd to yyyy-mm-dd for comparison
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
    
    // Database stores dates as dd.mm.yyyy strings
    // We need to fetch all and filter in memory since string comparison doesn't work correctly
    const whereClause: any = {};
    
    // If specific IDs requested, fetch only those
    if (idsParam) {
      const ids = idsParam.split(',').map(id => id.trim());
      whereClause.id = { in: ids };
      console.log('[API] Fetching specific IDs:', ids);
    }
    
    // Limit to recent 1000 records by default unless specific IDs requested
    const defaultLimit = 1000;
    const isUnfiltered = !fromDate && !toDate && !idsParam && !rawRecordUuid;
    let limit = idsParam
      ? undefined
      : (limitParam ? (limitParam === '0' ? undefined : parseInt(limitParam)) : (isUnfiltered ? undefined : defaultLimit));
    const offset = offsetParam ? parseInt(offsetParam) : 0;
    
    // Warn if requesting too many records
    if (limit && limit > 5000) {
      console.warn('[API] ⚠️ Large limit requested:', limit, '- this may be slow. Consider pagination.');
    }
    
    console.log('[API] Fetch params:', { limit, offset, hasIds: !!idsParam });
    
    console.log('[API] Step 1: Fetching transactions with JOINs...');
    // Use optimized SQL with all JOINs in one query to avoid N+1 problem
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
        ORDER BY cba.transaction_date DESC, cba.id DESC${limitSql}`
      );
    }
    console.log('[API] Step 1 complete: Got', transactions.length, 'transactions with all joins');
    
    console.log('[API] Step 2: Getting total count...');
    // Get total count for pagination (only when not fetching specific IDs and limit is set)
    const totalCount = idsParam || !limit
      ? undefined
      : (await prisma.$queryRawUnsafe<Array<{count: bigint}>>(
          `SELECT SUM(count)::bigint as count FROM (
            ${SOURCE_TABLES.map(table => `SELECT COUNT(*)::bigint as count FROM "${table.name}"`).join(' UNION ALL ')}
          ) counts`
        ))[0].count;
    console.log('[API] Step 2 complete: Total count =', totalCount);

    console.log('[API] Step 3: Filtering transactions by date...');
    // Filter in memory by converting dates to comparable format
    let filteredTransactions = transactions;
    if ((fromDate || toDate) && !idsParam) { // Skip date filtering when fetching specific IDs
      const fromComparable = toComparableDate(fromDate);
      const toComparable = toComparableDate(toDate);
      console.log('[API] Comparable dates:', { fromComparable, toComparable });
      
      filteredTransactions = transactions.filter(t => {
        const txDateComparable = toComparableDate(t.transaction_date);
        if (!txDateComparable) return true; // Include if date is invalid
        
        if (fromComparable && txDateComparable < fromComparable) return false;
        if (toComparable && txDateComparable > toComparable) return false;
        return true;
      });
      
      console.log('[API] Filtered from', transactions.length, 'to', filteredTransactions.length, 'records');
    }
    console.log('[API] Step 3 complete: Filtered count =', filteredTransactions.length);

    console.log('[API] Step 4: Skipping separate UUID queries - data already in JOINs...');
    // All data is now in the main query via JOINs - no need for separate queries
    const rawRecordUuids = [...new Set(filteredTransactions.map(t => t.raw_record_uuid).filter(Boolean))];
    console.log('[API] Step 4 complete: Will fetch applied_rule_id for', rawRecordUuids.length, 'raw records');
    
    console.log('[API] Step 5: Fetching balance records...');
    // Fetch balance records from bank_accounts table
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
    console.log('[API] Step 5 complete: Got', balanceRecords.length, 'balance records');

    // Fetch applied_rule_id from raw table (optional - may not exist on all environments)
    let rawRecordsWithRules: Array<{ uuid: string; applied_rule_id: number | null }> = [];
    try {
      if (rawRecordUuids.length > 0) {
        rawRecordsWithRules = await prisma.$queryRawUnsafe<Array<{ uuid: string; applied_rule_id: number | null }>>(
          `SELECT uuid, applied_rule_id FROM bog_gel_raw_893486000 WHERE uuid = ANY($1::uuid[])`,
          rawRecordUuids
        );
      }
    } catch (rawTableError) {
      console.warn('[API] Could not fetch applied_rule_id from raw table:', rawTableError);
      // Continue without applied_rule_id data
    }
    const appliedRuleMap = new Map(rawRecordsWithRules.map(r => [r.uuid, r.applied_rule_id]));

    // No need to fetch lookup data - already in JOINs
    // Map filteredTransactions directly with data from JOINs
    const result = filteredTransactions.map(row => {
      const base = toApi(row);
      const accountCurrencyCode = row.account_currency_code ?? null; // From JOIN
      const nominalCurrencyCode = row.nominal_currency_code ?? null; // From JOIN
      const accountNumber = row.account_number ?? null; // From JOIN
      const appliedRuleId = row.raw_record_uuid ? appliedRuleMap.get(row.raw_record_uuid) ?? null : null;
      
      return {
        ...base,
        applied_rule_id: appliedRuleId !== null && appliedRuleId !== undefined
          ? Number(appliedRuleId)
          : null,
        counteragent_name: row.counteragent_name ?? null, // From JOIN
        project_index: row.project_index ?? null, // From JOIN
        financial_code: row.financial_code ?? null, // From JOIN
        account_number: accountNumber && accountCurrencyCode ? `${accountNumber}${accountCurrencyCode}` : accountNumber,
        nominal_currency_code: nominalCurrencyCode,
      };
    });

    // Map balance records and apply date filtering
    const balanceResults = balanceRecords
      .map(row => balanceToApi(row, row.currency?.code ?? ''))
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

    // Combine regular transactions and balance records
    const combinedResult = [...result, ...balanceResults];

    if (idsParam) {
      console.log('[API] Step 7: Building response (ids only)...');
      return NextResponse.json({
        data: result,
        currency_summaries: [],
        pagination: {
          total: Number(totalCount),
          limit: result.length,
          offset: 0,
          hasMore: false,
        },
      });
    }

    // Calculate opening balances per currency
    // Opening balance = transactions NOT in the current result set + bank account balances
    const currencySummaries: Record<string, any> = {};
    
    // Get the IDs of transactions in the current result
    const fetchedIds = new Set(
      filteredTransactions
        .map(t => t.synthetic_id ?? t.id)
        .filter(id => id !== null && id !== undefined)
        .map(id => BigInt(id))
    );
    
    // Query for all OTHER transactions (not in the fetched set)
    const fetchedIdsArray = Array.from(fetchedIds);
    let unfetchedTransactions: Array<{account_currency_uuid: string, account_currency_amount: any}>;
    
    if (fetchedIdsArray.length > 0) {
      // Use NOT IN subquery to avoid bind variable limit (max 32767)
      // Convert IDs to comma-separated string for direct SQL injection (safe - BigInt values)
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

    console.log('[API] Fetched transaction IDs count:', fetchedIds.size);
    console.log('[API] Unfetched transactions count:', unfetchedTransactions.length);

    // Group unfetched transactions by currency (opening balance)
    const openingByCurrency: Record<string, number> = {};
    for (const tx of unfetchedTransactions) {
      if (tx.account_currency_uuid && tx.account_currency_amount) {
        const currencyUuid = tx.account_currency_uuid;
        const amount = Number(tx.account_currency_amount); // Raw SQL returns as string
        if (!isNaN(amount)) {
          openingByCurrency[currencyUuid] = (openingByCurrency[currencyUuid] || 0) + amount;
        }
      }
    }

    // Add bank account static balances (if any)
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

    console.log('[API] Step 6: Calculating inflow/outflow...');
    // Calculate inflow/outflow for filtered transactions per currency
    const inflowByCurrency: Record<string, number> = {};
    const outflowByCurrency: Record<string, number> = {};

    for (const tx of filteredTransactions) {
      const currencyUuid = tx.account_currency_uuid;
      // Raw SQL returns numeric as string, handle both
      const amount = tx.account_currency_amount ? Number(tx.account_currency_amount) : 0;
      
      if (currencyUuid && !isNaN(amount)) {
        if (amount > 0) {
          inflowByCurrency[currencyUuid] = (inflowByCurrency[currencyUuid] || 0) + amount;
        } else if (amount < 0) {
          outflowByCurrency[currencyUuid] = (outflowByCurrency[currencyUuid] || 0) + Math.abs(amount);
        }
      }
    }
    console.log('[API] Step 6 complete');

    // Build currency summaries
    // We need to get currency codes - fetch only unique ones used in opening balances
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

    console.log('[API] Step 7: Building response...');
    console.log('[API] - combinedResult length:', combinedResult.length);
    console.log('[API] - totalCount:', totalCount);
    
    return NextResponse.json({
      data: combinedResult,
      currency_summaries: Object.values(currencySummaries),
      pagination: totalCount !== undefined ? {
        total: Number(totalCount), // Convert BigInt to Number for JSON
        limit: limit ?? combinedResult.length,
        offset: offset,
        hasMore: Number(totalCount) > (offset + (limit ?? 0))
      } : undefined
    });
  } catch (error: any) {
    console.error("[GET /api/bank-transactions] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch bank transactions" },
      { status: 500 }
    );
  }
}

