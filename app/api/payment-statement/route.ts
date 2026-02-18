import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const SOURCE_TABLES = [
  { name: 'GE78BG0000000893486000_BOG_GEL', offset: 0 },
  { name: 'GE74BG0000000586388146_BOG_USD', offset: 300000000000 },
  { name: 'GE78BG0000000893486000_BOG_USD', offset: 500000000000 },
  { name: 'GE78BG0000000893486000_BOG_EUR', offset: 600000000000 },
  { name: 'GE78BG0000000893486000_BOG_AED', offset: 700000000000 },
  { name: 'GE78BG0000000893486000_BOG_GBP', offset: 800000000000 },
  { name: 'GE78BG0000000893486000_BOG_KZT', offset: 900000000000 },
  { name: 'GE78BG0000000893486000_BOG_CNY', offset: 950000000000 },
  { name: 'GE78BG0000000893486000_BOG_TRY', offset: 980000000000 },
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
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const normalizedPaymentId = paymentId.includes(':')
      ? paymentId.split(':')[0]
      : paymentId;

    // Get payment details (payments table)
    const paymentQuery = `
      SELECT 
        p.payment_id,
        p.record_uuid,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        p.created_at,
        p.updated_at,
        proj.project_index,
        proj.project_name,
        ca.name as counteragent_name,
        ca.identification_number as counteragent_id,
        fc.validation as financial_code_validation,
        fc.code as financial_code,
        j.job_name,
        j.floors,
        curr.code as currency_code
      FROM payments p
      LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
      LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
      LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
      WHERE (lower(p.payment_id) = lower($1) OR lower(p.payment_id) = lower($2))
        AND p.is_active = true
    `;

    const paymentResult = await prisma.$queryRawUnsafe(
      paymentQuery,
      paymentId,
      normalizedPaymentId
    );
    const payment = (paymentResult as any[])[0];

    // Fallback to salary_accruals if not found in payments
    const salaryResult = !payment
      ? await prisma.$queryRawUnsafe(
          `
          SELECT 
            sa.payment_id,
            sa.counteragent_uuid,
            sa.financial_code_uuid,
            sa.nominal_currency_uuid,
            sa.salary_month,
            sa.net_sum,
            sa.created_at,
            sa.updated_at,
            c.counteragent as counteragent_name,
            c.identification_number as counteragent_id,
            fc.validation as financial_code_validation,
            fc.code as financial_code,
            curr.code as currency_code
          FROM salary_accruals sa
          LEFT JOIN counteragents c ON sa.counteragent_uuid = c.counteragent_uuid
          LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
          LEFT JOIN currencies curr ON sa.nominal_currency_uuid = curr.uuid
          WHERE lower(sa.payment_id) = lower($1)
            OR lower(sa.payment_id) = lower($2)
          ORDER BY sa.salary_month DESC, sa.created_at DESC
          LIMIT 1
          `,
          paymentId,
          normalizedPaymentId
        )
      : [];
    const salaryPayment = (salaryResult as any[])[0];
    const isSalaryPayment = Boolean(salaryPayment);

    if (!payment && !salaryPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Get payment ledger entries
    const ledgerQuery = `
      SELECT 
        id,
        payment_id,
        effective_date,
        accrual,
        "order",
        comment,
        user_email,
        created_at
      FROM payments_ledger
      WHERE payment_id = $1
      ORDER BY effective_date DESC
    `;

    const ledgerResult = await prisma.$queryRawUnsafe(ledgerQuery, paymentId);

    const salaryLedgerQuery = `
      SELECT
        MIN(sa.id) as id,
        sa.payment_id,
        sa.salary_month,
        (date_trunc('month', sa.salary_month) + interval '1 month')::date as effective_date,
        SUM(sa.net_sum * CASE WHEN COALESCE(ca.pension_scheme, false) THEN 0.98 ELSE 1 END) as accrual,
        SUM(sa.net_sum * CASE WHEN COALESCE(ca.pension_scheme, false) THEN 0.98 ELSE 1 END) as "order",
        CONCAT('Salary accrual ', to_char(sa.salary_month, 'YYYY-MM')) as comment,
        MAX(sa.created_by) as user_email,
        MAX(sa.created_at) as created_at
      FROM salary_accruals sa
      LEFT JOIN counteragents ca ON sa.counteragent_uuid = ca.counteragent_uuid
      WHERE lower(sa.payment_id) = lower($1)
        OR lower(sa.payment_id) = lower($2)
      GROUP BY sa.payment_id, sa.salary_month
      ORDER BY sa.salary_month DESC
    `;

    const salaryLedgerResult = await prisma.$queryRawUnsafe(
      salaryLedgerQuery,
      paymentId,
      normalizedPaymentId
    );

    // Get bank transactions
    const bankQuery = `
      SELECT 
        result.id,
        result.synthetic_id,
        result.source_id,
        result.source_table,
        result.uuid,
        result.payment_id,
        result.dockey,
        result.entriesid,
        result.batch_payment_id_raw,
        result.raw_payment_id,
        result.account_currency_amount,
        result.nominal_amount,
        result.transaction_date,
        result.counteragent_account_number,
        result.description,
        result.created_at,
        result.bank_account_uuid,
        result.account_currency_uuid,
        result.bank_account_number,
        result.account_currency_code
      FROM (
        SELECT 
          (cba.id + cba.source_offset)::bigint as synthetic_id,
          cba.id as source_id,
          cba.source_table,
          cba.id,
          cba.uuid,
          cba.dockey,
          cba.entriesid,
          CASE WHEN cba.payment_id ILIKE 'BTC_%' THEN NULL ELSE cba.payment_id END as payment_id,
          NULL::text as batch_payment_id_raw,
          cba.payment_id::text as raw_payment_id,
          cba.account_currency_amount,
          cba.nominal_amount,
          cba.transaction_date,
          cba.counteragent_account_number,
          cba.description,
          cba.created_at,
          cba.bank_account_uuid,
          cba.account_currency_uuid,
          ba.account_number as bank_account_number,
          curr.code as account_currency_code
        FROM (
          ${SOURCE_TABLES.map((table) => `SELECT *, '${table.name}' as source_table, ${table.offset}::bigint as source_offset FROM "${table.name}"`).join(' UNION ALL ')}
        ) cba
        LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
        LEFT JOIN currencies curr ON cba.account_currency_uuid = curr.uuid
        WHERE NOT EXISTS (
          SELECT 1 FROM bank_transaction_batches btb
          WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
        )
          AND cba.payment_id NOT ILIKE 'BTC_%'
          AND (lower(cba.payment_id) = lower($1) OR lower(cba.payment_id) = lower($2))

        UNION ALL

        SELECT 
          (btb.id + ${BATCH_OFFSET} + cba.source_offset)::bigint as synthetic_id,
          cba.id as source_id,
          cba.source_table,
          cba.id,
          cba.uuid,
          cba.dockey,
          cba.entriesid,
          cba.payment_id,
          btb.payment_id as batch_payment_id_raw,
          cba.payment_id::text as raw_payment_id,
          (btb.partition_amount * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as account_currency_amount,
          (btb.nominal_amount * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount,
          cba.transaction_date,
          cba.counteragent_account_number,
          cba.description,
          cba.created_at,
          cba.bank_account_uuid,
          cba.account_currency_uuid,
          ba.account_number as bank_account_number,
          curr.code as account_currency_code
        FROM (
          ${SOURCE_TABLES.map((table) => `SELECT *, '${table.name}' as source_table, ${table.offset}::bigint as source_offset FROM "${table.name}"`).join(' UNION ALL ')}
        ) cba
        JOIN bank_transaction_batches btb
          ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
        LEFT JOIN payments p
          ON (
            btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
          ) OR (
            btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
          )
        LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
        LEFT JOIN currencies curr ON cba.account_currency_uuid = curr.uuid
        WHERE lower(
          COALESCE(
            CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
            p.payment_id
          )
        ) = lower($1)
        OR lower(
          COALESCE(
            CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
            p.payment_id
          )
        ) = lower($2)
      ) result
      ORDER BY result.transaction_date DESC
    `;

    const bankResult = await prisma.$queryRawUnsafe(
      bankQuery,
      paymentId,
      normalizedPaymentId
    );

    // Format response
    const response = {
      payment: payment
        ? {
            paymentId: payment.payment_id,
            recordUuid: payment.record_uuid,
            project: payment.project_index || payment.project_name,
            counteragent: payment.counteragent_name,
            counteragentUuid: payment.counteragent_uuid,
            counteragentId: payment.counteragent_id,
            financialCode: payment.financial_code_validation || payment.financial_code,
            job: payment.job_name,
            floors: payment.floors ? Number(payment.floors) : 0,
            incomeTax: isSalaryPayment ? false : (payment.income_tax || false),
            currency: payment.currency_code,
            createdAt: payment.created_at,
            updatedAt: payment.updated_at,
          }
        : {
            paymentId: salaryPayment.payment_id,
            recordUuid: null,
            project: null,
            counteragent: salaryPayment.counteragent_name,
            counteragentUuid: salaryPayment.counteragent_uuid,
            counteragentId: salaryPayment.counteragent_id,
            financialCode: salaryPayment.financial_code_validation || salaryPayment.financial_code,
            job: null,
            floors: 0,
            incomeTax: false,
            currency: salaryPayment.currency_code,
            createdAt: salaryPayment.created_at,
            updatedAt: salaryPayment.updated_at,
          },
      ledgerEntries: ([
        ...(ledgerResult as any[]),
        ...(salaryLedgerResult as any[]),
      ]).map(entry => ({
        id: Number(entry.id),
        effectiveDate: entry.effective_date,
        accrual: entry.accrual ? parseFloat(entry.accrual) : 0,
        order: entry.order ? parseFloat(entry.order) : 0,
        comment: entry.comment,
        userEmail: entry.user_email,
        createdAt: entry.created_at,
      })).sort((a, b) =>
        new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
      ),
      bankTransactions: (bankResult as any[]).map(tx => ({
        id: Number(tx.synthetic_id ?? tx.id),
        sourceId: Number(tx.source_id ?? tx.id),
        sourceTable: tx.source_table ?? null,
        uuid: tx.uuid,
        accountCurrencyAmount: tx.account_currency_amount ? parseFloat(tx.account_currency_amount) : 0,
        nominalAmount: tx.nominal_amount ? parseFloat(tx.nominal_amount) : 0,
        date: tx.transaction_date,
        id1: tx.dockey || null,
        id2: tx.entriesid || null,
        batchId: tx.raw_payment_id && /^BTC_/i.test(tx.raw_payment_id)
          ? tx.raw_payment_id
          : (tx.batch_payment_id_raw && /^BTC_/i.test(tx.batch_payment_id_raw)
            ? tx.batch_payment_id_raw
            : (tx.payment_id && /^BTC_/i.test(tx.payment_id) ? tx.payment_id : null)),
        counteragentAccountNumber: tx.counteragent_account_number,
        description: tx.description,
        createdAt: tx.created_at,
        accountLabel: `${tx.bank_account_number || ''} ${tx.account_currency_code || ''}`.trim() || '-',
      })),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching payment statement:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
