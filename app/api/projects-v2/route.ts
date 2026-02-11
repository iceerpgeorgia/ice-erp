import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


// GET all projects - FIXED VERSION with project_uuid join
export async function GET(req: NextRequest) {
  try {
    const projects = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.created_at,
        p.updated_at,
        p.project_uuid,
        p.counteragent_uuid,
        p.project_name,
        p.financial_code_uuid,
        TO_CHAR(p.date, 'DD.MM.YYYY') as date,
        p.value,
        p.currency_uuid,
        p.state_uuid,
        p.oris_1630,
        p.contract_no,
        p.project_index,
        p.financial_code,
        p.currency,
        p.state,
        p.counteragent,
        '[]'::json as employees,
        COALESCE(pp.total_payment, 0) as total_payments,
        (p.value - COALESCE(pp.total_payment, 0)) as balance
      FROM projects p
      LEFT JOIN (
        SELECT
          p.project_uuid,
          p.counteragent_uuid,
          SUM(ABS(COALESCE(bank_agg.total_payment, 0))) as total_payment
        FROM payments p
        LEFT JOIN (
          SELECT
            payment_id,
            SUM(nominal_amount) as total_payment
          FROM consolidated_bank_accounts
          WHERE payment_id IS NOT NULL
          GROUP BY payment_id
        ) bank_agg ON p.payment_id = bank_agg.payment_id
        WHERE p.is_active = true
        GROUP BY p.project_uuid, p.counteragent_uuid
      ) pp ON p.project_uuid = pp.project_uuid AND p.counteragent_uuid = pp.counteragent_uuid
      ORDER BY p.created_at DESC
    `;

    // Convert BigInt to Number for JSON serialization
    const serialized = (projects as any[]).map((project: any) => ({
      ...project,
      id: Number(project.id),
    }));

    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error('GET /projects-v2 error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
