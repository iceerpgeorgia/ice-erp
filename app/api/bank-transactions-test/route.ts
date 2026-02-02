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
    name: "GE65TB7856036050100002_TBC_GEL",
    offset: 1000000000000,
    bankAccountUuid: "1ef0f05d-00cc-4c6c-a858-4d8d50069496",
    accountCurrencyUuid: "5a2d799d-22a1-4e0a-b029-8031a1df6d56",
    isTbc: true,
  },
];

const UNION_SQL = SOURCE_TABLES.map((table) => {
  if (!table.isTbc) {
    return `SELECT
      cba.id,
      cba.uuid,
      cba.bank_account_uuid,
      cba.raw_record_uuid,
      cba.transaction_date,
      cba.correction_date,
      cba.exchange_rate,
      cba.description,
      cba.counteragent_uuid,
      cba.project_uuid,
      cba.financial_code_uuid,
      cba.account_currency_uuid,
      cba.account_currency_amount,
      cba.nominal_currency_uuid,
      cba.nominal_amount,
      cba.payment_id,
      cba.processing_case,
      cba.created_at,
      cba.updated_at,
      cba.counteragent_account_number,
      cba.parsing_lock,
      cba.applied_rule_id,
      (cba.id + ${table.offset})::bigint as synthetic_id,
      cba.id as source_id,
      '${table.name}' as source_table
    FROM "${table.name}" cba`;
  }

  return `SELECT
      t.id,
      t.uuid,
      '${table.bankAccountUuid}'::uuid as bank_account_uuid,
      t.uuid as raw_record_uuid,
      REPLACE(t.date, '/', '.') as transaction_date,
      NULL::date as correction_date,
      NULL::numeric as exchange_rate,
      CASE
        WHEN t.additional_information IS NOT NULL AND t.additional_information <> ''
          THEN COALESCE(t.description, '') || ' | ' || t.additional_information
        ELSE t.description
      END as description,
      NULL::uuid as counteragent_uuid,
      NULL::uuid as project_uuid,
      NULL::uuid as financial_code_uuid,
      '${table.accountCurrencyUuid}'::uuid as account_currency_uuid,
      (COALESCE(NULLIF(t.paid_in, '')::numeric, 0) - COALESCE(NULLIF(t.paid_out, '')::numeric, 0)) as account_currency_amount,
      '${table.accountCurrencyUuid}'::uuid as nominal_currency_uuid,
      (COALESCE(NULLIF(t.paid_in, '')::numeric, 0) - COALESCE(NULLIF(t.paid_out, '')::numeric, 0)) as nominal_amount,
      NULL::text as payment_id,
      t.processing_case,
      t.created_at,
      t.updated_at,
      t.partner_account_number as counteragent_account_number,
      FALSE as parsing_lock,
      t.applied_rule_id,
      (t.id + ${table.offset})::bigint as synthetic_id,
      t.id as source_id,
      '${table.name}' as source_table
    FROM "${table.name}" t`;
}).join(' UNION ALL ');

const UNFETCHED_UNION_SQL = SOURCE_TABLES.map((table) => {
  if (!table.isTbc) {
    return `SELECT
      (id + ${table.offset})::bigint as synthetic_id,
      account_currency_uuid,
      account_currency_amount
    FROM "${table.name}"`;
  }

  return `SELECT
      (id + ${table.offset})::bigint as synthetic_id,
      '${table.accountCurrencyUuid}'::uuid as account_currency_uuid,
      (COALESCE(NULLIF(paid_in, '')::numeric, 0) - COALESCE(NULLIF(paid_out, '')::numeric, 0)) as account_currency_amount
    FROM "${table.name}"`;
}).join(' UNION ALL ');

// Map raw SQL results (snake_case) to API response (snake_case)
function toApi(row: any) {
  return {
    id: Number(row.synthetic_id ?? row.id),
    source_table: row.source_table ?? null,
    source_id: row.source_id ?? row.id ?? null,
    uuid: row.uuid,
    bank_account_uuid: row.bank_account_uuid,
    raw_record_uuid: row.raw_record_uuid,
    transaction_date: row.transaction_date,
    correction_date: row.correction_date || null,
    exchange_rate: row.exchange_rate ? Number(row.exchange_rate) : null,
    description: row.description,
    counteragent_uuid: row.counteragent_uuid,
    counteragent_account_number: row.counteragent_account_number ? String(row.counteragent_account_number) : null,
    project_uuid: row.project_uuid,
    financial_code_uuid: row.financial_code_uuid,
    account_currency_uuid: row.account_currency_uuid,
    account_currency_amount: row.account_currency_amount ? Number(row.account_currency_amount) : null,
    nominal_currency_uuid: row.nominal_currency_uuid,
    nominal_amount: row.nominal_amount ? Number(row.nominal_amount) : null,
    payment_id: row.payment_id ?? null,
    parsing_lock: row.parsing_lock ?? false,
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
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    console.log('[API] Query params:', { fromDate, toDate, idsParam, limitParam, offsetParam });

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

    const defaultLimit = 1000;
    const isUnfiltered = !fromDate && !toDate && !idsParam;
    let limit = idsParam
      ? undefined
      : (limitParam ? (limitParam === '0' ? undefined : parseInt(limitParam)) : (isUnfiltered ? undefined : defaultLimit));
    const offset = offsetParam ? parseInt(offsetParam) : 0;

    if (limit && limit > 5000) {
      console.warn('[API] ⚠️ Large limit requested:', limit, '- this may be slow. Consider pagination.');
    }

    console.log('[API] Fetch params:', { limit, offset, hasIds: !!idsParam });

    console.log('[API] Step 1: Fetching transactions with JOINs...');
    let transactions: any[];

    if (idsParam) {
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
         LEFT JOIN counteragents ca ON cba.counteragent_uuid = ca.counteragent_uuid
         LEFT JOIN projects p ON cba.project_uuid = p.project_uuid
         LEFT JOIN financial_codes fc ON cba.financial_code_uuid = fc.uuid
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
         LEFT JOIN counteragents ca ON cba.counteragent_uuid = ca.counteragent_uuid
         LEFT JOIN projects p ON cba.project_uuid = p.project_uuid
         LEFT JOIN financial_codes fc ON cba.financial_code_uuid = fc.uuid
         LEFT JOIN currencies curr_acc ON cba.account_currency_uuid = curr_acc.uuid
         LEFT JOIN currencies curr_nom ON cba.nominal_currency_uuid = curr_nom.uuid
         ORDER BY cba.transaction_date DESC, cba.id DESC${limitSql}`
      );
    }

    console.log('[API] Step 1 complete: Got', transactions.length, 'transactions with all joins');

    console.log('[API] Step 2: Getting total count...');
    const totalCount = idsParam || !limit ? undefined : (await prisma.$queryRawUnsafe<Array<{count: bigint}>>(
      `SELECT SUM(count)::bigint as count FROM (
        ${SOURCE_TABLES.map(table => `SELECT COUNT(*)::bigint as count FROM "${table.name}"`).join(' UNION ALL ')}
      ) counts`
    ))[0].count;
    console.log('[API] Step 2 complete: Total count =', totalCount);

    console.log('[API] Step 3: Filtering transactions by date...');
    let filteredTransactions = transactions;
    if ((fromDate || toDate) && !idsParam) {
      const fromComparable = toComparableDate(fromDate);
      const toComparable = toComparableDate(toDate);
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

    const combinedResult = [...result, ...balanceResults];

    const currencySummaries: Record<string, any> = {};

    const fetchedIdsArray = Array.from(
      new Set(
        filteredTransactions
          .map(t => t.id)
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

    for (const tx of filteredTransactions) {
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
