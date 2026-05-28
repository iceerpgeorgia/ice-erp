import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/payments/meta?paymentId=<payment_id>
 * Returns lightweight payment metadata needed for attachment upload:
 *   currencyCode, counteragentInn
 */
export async function GET(request: NextRequest) {
  const paymentId = request.nextUrl.searchParams.get('paymentId');
  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
  }

  try {
    const rows = await prisma.$queryRawUnsafe<
      {
        currency_code: string | null;
        identification_number: string | null;
        project_uuid: string | null;
        project_name: string | null;
      }[]
    >(
      `SELECT curr.code AS currency_code, ca.identification_number,
              p.project_uuid, proj.project_name
       FROM payments p
       LEFT JOIN currencies curr ON curr.uuid = p.currency_uuid
       LEFT JOIN counteragents ca ON ca.counteragent_uuid = p.counteragent_uuid
       LEFT JOIN projects proj ON proj.project_uuid = p.project_uuid
       WHERE p.payment_id = $1
       LIMIT 1`,
      paymentId
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({
      currencyCode: rows[0].currency_code ?? null,
      counteragentInn: rows[0].identification_number ?? null,
      projectUuid: rows[0].project_uuid ?? null,
      projectName: rows[0].project_name ?? null,
    });
  } catch (error: any) {
    console.error('[payments/meta] Error:', error?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
