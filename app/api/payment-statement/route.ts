import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const SOURCE_TABLES = [
  "GE78BG0000000893486000_BOG_GEL",
  "GE65TB7856036050100002_TBC_GEL",
];

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
          WHERE lower(sa.payment_id) = lower($1) OR lower(sa.payment_id) = lower($2)
          LIMIT 1
          `,
          paymentId,
          normalizedPaymentId
        )
      : [];
    const salaryPayment = (salaryResult as any[])[0];

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
        (date_trunc('month', sa.salary_month) + interval '1 month')::date as effective_date,
        SUM(sa.net_sum * CASE WHEN COALESCE(ca.pension_scheme, false) THEN 0.98 ELSE 1 END) as accrual,
        SUM(sa.net_sum * CASE WHEN COALESCE(ca.pension_scheme, false) THEN 0.98 ELSE 1 END) as "order",
        CONCAT('Salary accrual ', to_char(sa.salary_month, 'YYYY-MM')) as comment,
        MAX(sa.created_by) as user_email,
        MAX(sa.created_at) as created_at
      FROM salary_accruals sa
      LEFT JOIN counteragents ca ON sa.counteragent_uuid = ca.counteragent_uuid
      WHERE lower(sa.payment_id) = lower($1) OR lower(sa.payment_id) = lower($2)
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
        cba.id,
        cba.uuid,
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
        ${SOURCE_TABLES.map((table) => `SELECT * FROM "${table}"`).join(' UNION ALL ')}
      ) cba
      LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
      LEFT JOIN currencies curr ON cba.account_currency_uuid = curr.uuid
      WHERE lower(cba.payment_id) = lower($1) OR lower(cba.payment_id) = lower($2)
      ORDER BY cba.transaction_date DESC
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
            incomeTax: payment.income_tax || false,
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
        id: Number(tx.id),
        uuid: tx.uuid,
        accountCurrencyAmount: tx.account_currency_amount ? parseFloat(tx.account_currency_amount) : 0,
        nominalAmount: tx.nominal_amount ? parseFloat(tx.nominal_amount) : 0,
        date: tx.transaction_date,
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
