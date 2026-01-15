import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const maxDate = searchParams.get('maxDate');

    // Build the HAVING clause for date filtering (must be applied after GROUP BY)
    // Include both ledger dates AND bank transaction dates
    // Use COALESCE to handle NULL dates (when one source has no data)
    const dateFilter = maxDate 
      ? `HAVING COALESCE(GREATEST(MAX(pl.effective_date), MAX(cba.transaction_date::date)), MAX(pl.effective_date), MAX(cba.transaction_date::date)) <= '${maxDate}'::date` 
      : '';

    // Query to get payments with aggregated ledger data and actual payments from bank accounts
    const query = `
      SELECT 
        p.payment_id,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        proj.project_index,
        proj.project_name,
        ca.counteragent as counteragent_formatted,
        ca.name as counteragent_name,
        ca.identification_number as counteragent_id,
        fc.validation as financial_code_validation,
        fc.code as financial_code,
        j.job_name,
        j.floors,
        curr.code as currency_code,
        COALESCE(SUM(pl.accrual), 0) as total_accrual,
        COALESCE(SUM(pl."order"), 0) as total_order,
        COALESCE(SUM(cba.nominal_amount), 0) as total_payment,
        COALESCE(GREATEST(MAX(pl.effective_date), MAX(cba.transaction_date::date)), MAX(pl.effective_date), MAX(cba.transaction_date::date)) as latest_date
      FROM payments p
      LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
      LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
      LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
      LEFT JOIN payments_ledger pl ON p.payment_id = pl.payment_id
      LEFT JOIN consolidated_bank_accounts cba ON p.payment_id = cba.payment_id
      WHERE p.is_active = true
      GROUP BY 
        p.payment_id,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        proj.project_index,
        proj.project_name,
        ca.counteragent,
        ca.name,
        ca.identification_number,
        fc.validation,
        fc.code,
        j.job_name,
        j.floors,
        curr.code
      ${dateFilter}
      ORDER BY p.payment_id DESC
    `;

    const reportData = await prisma.$queryRawUnsafe(query);

    const formattedData = (reportData as any[]).map(row => ({
      paymentId: row.payment_id,
      counteragent: row.counteragent_formatted || row.counteragent_name,
      project: row.project_index,
      job: row.job_name,
      floors: row.floors ? Number(row.floors) : 0,
      financialCode: row.financial_code_validation || row.financial_code,
      incomeTax: row.income_tax || false,
      currency: row.currency_code,
      accrual: row.total_accrual ? parseFloat(row.total_accrual) : 0,
      order: row.total_order ? parseFloat(row.total_order) : 0,
      payment: row.total_payment ? parseFloat(row.total_payment) : 0,
      latestDate: row.latest_date || null,
      // Calculated fields
      accrualPerFloor: row.floors && row.total_accrual 
        ? parseFloat((parseFloat(row.total_accrual) / Number(row.floors)).toFixed(2))
        : 0,
      paidPercent: row.total_accrual && parseFloat(row.total_accrual) !== 0
        ? parseFloat(((parseFloat(row.total_payment || 0) / parseFloat(row.total_accrual)) * 100).toFixed(2))
        : 0,
      due: parseFloat((parseFloat(row.total_order || 0) - parseFloat(row.total_payment || 0)).toFixed(2)),
      balance: parseFloat((parseFloat(row.total_accrual || 0) - parseFloat(row.total_payment || 0)).toFixed(2)),
    }));

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error('Error fetching payments report:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
