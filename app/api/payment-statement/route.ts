import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const DECONSOLIDATED_TABLE = "GE78BG0000000893486000_BOG_GEL";

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

    // Get payment details
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
      WHERE p.payment_id = $1 AND p.is_active = true
    `;

    const paymentResult = await prisma.$queryRawUnsafe(paymentQuery, paymentId);
    const payment = (paymentResult as any[])[0];

    if (!payment) {
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
      FROM "${DECONSOLIDATED_TABLE}" cba
      LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
      LEFT JOIN currencies curr ON cba.account_currency_uuid = curr.uuid
      WHERE cba.payment_id = $1
      ORDER BY cba.transaction_date DESC
    `;

    const bankResult = await prisma.$queryRawUnsafe(bankQuery, paymentId);

    // Format response
    const response = {
      payment: {
        paymentId: payment.payment_id,
        recordUuid: payment.record_uuid,
        project: payment.project_index || payment.project_name,
        counteragent: payment.counteragent_name,
        counteragentId: payment.counteragent_id,
        financialCode: payment.financial_code_validation || payment.financial_code,
        job: payment.job_name,
        floors: payment.floors ? Number(payment.floors) : 0,
        incomeTax: payment.income_tax || false,
        currency: payment.currency_code,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
      },
      ledgerEntries: (ledgerResult as any[]).map(entry => ({
        id: Number(entry.id),
        effectiveDate: entry.effective_date,
        accrual: entry.accrual ? parseFloat(entry.accrual) : 0,
        order: entry.order ? parseFloat(entry.order) : 0,
        comment: entry.comment,
        userEmail: entry.user_email,
        createdAt: entry.created_at,
      })),
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
