import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectUuid = searchParams.get('projectUuid');
    const counteragentUuid = searchParams.get('counteragentUuid');
    const financialCodeUuid = searchParams.get('financialCodeUuid');
    const currencyUuid = searchParams.get('currencyUuid');
    const incomeTax = searchParams.get('incomeTax') === 'true';

    if (!projectUuid || !counteragentUuid || !financialCodeUuid || !currencyUuid) {
      return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
    }

    const rows = await prisma.$queryRawUnsafe<Array<{
      job_uuid: string | null;
      accrual_sum: string;
      order_sum: string;
    }>>(
      `SELECT
        p.job_uuid::text,
        COALESCE(SUM(pl.accrual), 0) AS accrual_sum,
        COALESCE(SUM(pl."order"), 0) AS order_sum
       FROM payments p
       JOIN payments_ledger pl ON p.payment_id = pl.payment_id
       WHERE p.project_uuid = $1::uuid
         AND p.counteragent_uuid = $2::uuid
         AND p.financial_code_uuid = $3::uuid
         AND p.currency_uuid = $4::uuid
         AND p.income_tax = $5
       GROUP BY p.job_uuid`,
      projectUuid, counteragentUuid, financialCodeUuid, currencyUuid, incomeTax
    );

    return NextResponse.json(rows.map(r => ({
      jobUuid: r.job_uuid ?? null,
      accrualSum: Number(r.accrual_sum),
      orderSum: Number(r.order_sum),
    })));
  } catch (error: any) {
    console.error('Error fetching ledger sums:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
