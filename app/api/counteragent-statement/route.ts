import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const computeAccountAmountFromNominal = (
  nominalAmount: number,
  exchangeRate: number,
  accountCode: string,
  nominalCode: string
): number => {
  if (!exchangeRate || !Number.isFinite(exchangeRate) || exchangeRate === 0) {
    return nominalAmount;
  }

  if (accountCode === nominalCode) {
    return nominalAmount;
  }

  if (accountCode === 'GEL' && nominalCode !== 'GEL') {
    return nominalAmount * exchangeRate;
  }

  if (nominalCode === 'GEL' && accountCode !== 'GEL') {
    return nominalAmount / exchangeRate;
  }

  return nominalAmount * exchangeRate;
};

const SOURCE_TABLES = [
  { name: 'GE78BG0000000893486000_BOG_GEL', offset: 0 },
  { name: 'GE65TB7856036050100002_TBC_GEL', offset: 1000000000000 },
];

const BATCH_OFFSET = 2000000000000;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const counteragentUuid = searchParams.get('counteragentUuid');

    if (!counteragentUuid) {
      return NextResponse.json({ error: 'Counteragent UUID is required' }, { status: 400 });
    }

    const counteragentRows = await prisma.$queryRawUnsafe<
      Array<{ counteragent_uuid: string; counteragent_name: string | null; counteragent_id: string | null }>
    >(
      `SELECT counteragent_uuid, counteragent as counteragent_name, identification_number as counteragent_id
       FROM counteragents
       WHERE counteragent_uuid = $1::uuid
       LIMIT 1`,
      counteragentUuid
    );

    const counteragent = counteragentRows[0] ?? null;

    const paymentRows = await prisma.$queryRawUnsafe<Array<{
      payment_id: string;
      project_index: string | null;
      project_name: string | null;
      financial_code_validation: string | null;
      financial_code: string | null;
      job_name: string | null;
      income_tax: boolean | null;
      currency_code: string | null;
    }>>(
      `SELECT
         p.payment_id,
         proj.project_index,
         proj.project_name,
         fc.validation as financial_code_validation,
         fc.code as financial_code,
         j.job_name,
         p.income_tax,
         curr.code as currency_code
       FROM payments p
       LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
       LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
       LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
       LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
       WHERE p.counteragent_uuid = $1::uuid AND p.is_active = true`,
      counteragentUuid
    );

    const salaryRows = await prisma.$queryRawUnsafe<Array<{
      payment_id: string;
      financial_code_validation: string | null;
      financial_code: string | null;
      currency_code: string | null;
    }>>(
      `SELECT
         sa.payment_id,
         fc.validation as financial_code_validation,
         fc.code as financial_code,
         curr.code as currency_code
       FROM salary_accruals sa
       LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
       LEFT JOIN currencies curr ON sa.nominal_currency_uuid = curr.uuid
       WHERE sa.counteragent_uuid = $1::uuid`,
      counteragentUuid
    );

    const normalizePaymentKey = (value: string) => value.trim().toLowerCase();
    const salaryInfoMap = new Map<string, { financialCode: string | null; currency: string | null }>();
    for (const row of salaryRows) {
      if (!row.payment_id) continue;
      const key = normalizePaymentKey(row.payment_id);
      salaryInfoMap.set(key, {
        financialCode: row.financial_code_validation || row.financial_code || null,
        currency: row.currency_code || null,
      });
    }

    const paymentInfoMap = new Map<string, any>();
    const paymentIdSet = new Set<string>();
    for (const row of paymentRows) {
      if (!row.payment_id) continue;
      const key = normalizePaymentKey(row.payment_id);
      paymentIdSet.add(row.payment_id);
      const salaryInfo = salaryInfoMap.get(key);
      paymentInfoMap.set(key, {
        project: salaryInfo ? null : (row.project_index || row.project_name || null),
        financialCode: salaryInfo ? salaryInfo.financialCode : (row.financial_code_validation || row.financial_code || null),
        job: salaryInfo ? null : (row.job_name || null),
        incomeTax: salaryInfo ? null : (row.income_tax ?? null),
        currency: salaryInfo ? salaryInfo.currency : (row.currency_code || null),
      });
    }
    for (const row of salaryRows) {
      if (!row.payment_id) continue;
      const key = normalizePaymentKey(row.payment_id);
      paymentIdSet.add(row.payment_id);
      paymentInfoMap.set(key, {
        project: null,
        financialCode: row.financial_code_validation || row.financial_code || null,
        job: null,
        incomeTax: null,
        currency: row.currency_code || null,
      });
    }

    const paymentIds = Array.from(paymentIdSet.values());

    const ledgerEntries = paymentIds.length
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT
             id,
             payment_id,
             effective_date,
             accrual,
             "order",
             comment,
             user_email,
             created_at
           FROM payments_ledger
           WHERE payment_id = ANY($1::text[])
             AND (is_deleted = false OR is_deleted IS NULL)
           ORDER BY effective_date DESC`,
          paymentIds
        )
      : [];

    const bankTransactions = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        result.synthetic_id,
        result.source_id,
        result.source_table,
        result.id,
         result.uuid,
         result.payment_id,
         result.account_currency_amount,
         result.nominal_amount,
         result.exchange_rate,
         result.transaction_date,
         result.counteragent_account_number,
         result.description,
         result.created_at,
         result.bank_account_number,
         result.account_currency_code,
         result.nominal_currency_code
       FROM (
         SELECT
           (cba.id + cba.source_offset)::bigint as synthetic_id,
           cba.id as source_id,
           cba.source_table,
           cba.id,
           cba.uuid,
           cba.payment_id,
           cba.account_currency_amount,
           cba.nominal_amount,
           cba.exchange_rate,
           cba.transaction_date,
           cba.counteragent_account_number,
           cba.description,
           cba.created_at,
           ba.account_number as bank_account_number,
           curr.code as account_currency_code,
           nominal_curr.code as nominal_currency_code
         FROM (
           ${SOURCE_TABLES.map((table) => `SELECT *, '${table.name}' as source_table, ${table.offset}::bigint as source_offset FROM "${table.name}"`).join(' UNION ALL ')}
         ) cba
         LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
         LEFT JOIN currencies curr ON cba.account_currency_uuid = curr.uuid
         LEFT JOIN currencies nominal_curr ON cba.nominal_currency_uuid = nominal_curr.uuid
         WHERE NOT EXISTS (
           SELECT 1 FROM bank_transaction_batches btb
           WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
         )
           AND cba.counteragent_uuid = $1::uuid

         UNION ALL

         SELECT
           (btb.id + ${BATCH_OFFSET} + cba.source_offset)::bigint as synthetic_id,
           cba.id as source_id,
           cba.source_table,
           cba.id,
           cba.uuid,
           btb.payment_id,
           (btb.partition_amount * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as account_currency_amount,
           (btb.nominal_amount * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount,
           cba.exchange_rate,
           cba.transaction_date,
           cba.counteragent_account_number,
           cba.description,
           cba.created_at,
           ba.account_number as bank_account_number,
           curr.code as account_currency_code,
           nominal_curr.code as nominal_currency_code
         FROM (
           ${SOURCE_TABLES.map((table) => `SELECT *, '${table.name}' as source_table, ${table.offset}::bigint as source_offset FROM "${table.name}"`).join(' UNION ALL ')}
         ) cba
         JOIN bank_transaction_batches btb
           ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
         LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
         LEFT JOIN currencies curr ON cba.account_currency_uuid = curr.uuid
         LEFT JOIN currencies nominal_curr ON COALESCE(btb.nominal_currency_uuid, cba.nominal_currency_uuid) = nominal_curr.uuid
         WHERE btb.counteragent_uuid = $1::uuid
       ) result
       ORDER BY result.transaction_date DESC`,
      counteragentUuid
    );

    return NextResponse.json({
      counteragent,
      paymentIds,
      ledgerEntries: ledgerEntries.map((entry) => {
        const info = entry.payment_id ? paymentInfoMap.get(normalizePaymentKey(entry.payment_id)) : null;
        return {
        id: Number(entry.id),
        paymentId: entry.payment_id,
        effectiveDate: entry.effective_date,
        accrual: entry.accrual ? parseFloat(entry.accrual) : 0,
        order: entry.order ? parseFloat(entry.order) : 0,
        comment: entry.comment,
        userEmail: entry.user_email,
        createdAt: entry.created_at,
          project: info?.project || null,
          financialCode: info?.financialCode || null,
          job: info?.job || null,
          incomeTax: info?.incomeTax ?? null,
          currency: info?.currency || null,
        };
      }),
      bankTransactions: bankTransactions.map((tx) => {
        const info = tx.payment_id ? paymentInfoMap.get(normalizePaymentKey(tx.payment_id)) : null;
        const accountCurrencyAmount = tx.account_currency_amount ? parseFloat(tx.account_currency_amount) : 0;
        const nominalAmount = tx.nominal_amount ? parseFloat(tx.nominal_amount) : 0;
        const exchangeRate = tx.exchange_rate ? parseFloat(tx.exchange_rate) : 0;
        const accountCurrencyCode = tx.account_currency_code || null;
        const nominalCurrencyCode = tx.nominal_currency_code || null;

        let displayAccountAmount = accountCurrencyAmount;
        if (
          accountCurrencyCode &&
          nominalCurrencyCode &&
          accountCurrencyCode !== nominalCurrencyCode &&
          exchangeRate &&
          nominalAmount !== 0 &&
          accountCurrencyAmount === nominalAmount
        ) {
          displayAccountAmount = computeAccountAmountFromNominal(
            nominalAmount,
            exchangeRate,
            accountCurrencyCode,
            nominalCurrencyCode
          );
        }

        return {
        id: Number(tx.synthetic_id ?? tx.id),
        sourceId: Number(tx.source_id ?? tx.id),
        sourceTable: tx.source_table ?? null,
        uuid: tx.uuid,
        paymentId: tx.payment_id,
        accountCurrencyAmount: displayAccountAmount,
        nominalAmount,
        date: tx.transaction_date,
        counteragentAccountNumber: tx.counteragent_account_number,
        description: tx.description,
        createdAt: tx.created_at,
        accountLabel: `${tx.bank_account_number || ''} ${tx.account_currency_code || ''}`.trim() || '-',
          project: info?.project || null,
          financialCode: info?.financialCode || null,
          job: info?.job || null,
          incomeTax: info?.incomeTax ?? null,
          currency: info?.currency || null,
        };
      }),
    });
  } catch (error: any) {
    console.error('Error fetching counteragent statement:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
