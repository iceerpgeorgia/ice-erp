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

    // Query to get payments with aggregated ledger data
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
        ca.name as counteragent_name,
        ca.identification_number as counteragent_id,
        fc.validation as financial_code_validation,
        fc.code as financial_code,
        j.job_index,
        j.job_name,
        j.floors,
        curr.code as currency_code,
        COALESCE(SUM(pl.accrual), 0) as total_accrual,
        COALESCE(SUM(pl."order"), 0) as total_order
      FROM payments p
      LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
      LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
      LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
      LEFT JOIN payments_ledger pl ON p.payment_id = pl.payment_id
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
        ca.name,
        ca.identification_number,
        fc.validation,
        fc.code,
        j.job_index,
        j.job_name,
        j.floors,
        curr.code
      ORDER BY p.payment_id DESC
    `;

    const reportData = await prisma.$queryRawUnsafe(query);

    const formattedData = (reportData as any[]).map(row => ({
      paymentId: row.payment_id,
      counteragent: row.counteragent_name,
      counteragentId: row.counteragent_id,
      project: row.project_index || row.project_name,
      job: row.job_index || row.job_name,
      floors: row.floors ? Number(row.floors) : 0,
      financialCode: row.financial_code_validation || row.financial_code,
      incomeTax: row.income_tax || false,
      currency: row.currency_code,
      accrual: row.total_accrual ? parseFloat(row.total_accrual) : 0,
      order: row.total_order ? parseFloat(row.total_order) : 0,
      // Calculated fields
      accrualPerFloor: row.floors && row.total_accrual 
        ? parseFloat((parseFloat(row.total_accrual) / Number(row.floors)).toFixed(2))
        : 0,
      balance: row.total_accrual 
        ? parseFloat((parseFloat(row.total_accrual) - parseFloat(row.total_order || 0)).toFixed(2))
        : 0,
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
