import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { counteragentUuid: string } }
) {
  try {
    const { counteragentUuid } = params;

    if (!counteragentUuid) {
      return NextResponse.json(
        { error: 'Counteragent UUID is required' },
        { status: 400 }
      );
    }

    // Find all payments for this counteragent
    const payments = await prisma.payments.findMany({
      where: {
        counteragent_uuid: counteragentUuid,
        is_active: true,
      },
      select: {
        payment_id: true,
        project_uuid: true,
        job_uuid: true,
        currency_uuid: true,
        financial_code_uuid: true,
      },
    });

    // Fetch related data for each payment
    const paymentsWithDetails = await Promise.all(
      payments.map(async (payment) => {
        // Fetch job with brand info separately if needed
        let job: any = null;
        if (payment.jobUuid) {
          const jobRows: any[] = await prisma.$queryRaw`
            SELECT 
              j.job_name,
              CONCAT(
                j.job_name,
                ' | ',
                COALESCE(b.name, 'No Brand'),
                ' | ',
                j.floors,
                ' | ',
                j.weight,
                CASE WHEN j.is_ff THEN ' | FF' ELSE '' END
              ) as job_display
            FROM jobs j
            LEFT JOIN brands b ON j.brand_uuid = b.uuid
            WHERE j.job_uuid = ${payment.jobUuid}::uuid
            LIMIT 1
          `;
          job = jobRows[0] || null;
        }

        const [currency, project, financialCode] = await Promise.all([
          payment.currencyUuid
            ? prisma.currency.findUnique({
                where: { uuid: payment.currencyUuid },
                select: { code: true },
              })
            : null,
          payment.projectUuid
            ? prisma.project.findUnique({
                where: { projectUuid: payment.projectUuid },
                select: { projectName: true },
              })
            : null,
          payment.financialCodeUuid
            ? prisma.financialCode.findUnique({
                where: { uuid: payment.financialCodeUuid },
                select: { validation: true },
              })
            : null,
        ]);

        return {
          paymentId: payment.paymentId,
          projectUuid: payment.projectUuid,
          jobUuid: payment.jobUuid,
          financialCodeUuid: payment.financialCodeUuid,
          currencyUuid: payment.currencyUuid,
          projectName: project?.projectName || '',
          jobName: job?.job_name || '',
          jobDisplay: job?.job_display || '',
          currencyCode: currency?.code || '',
          financialCodeValidation: financialCode?.validation || '',
        };
      })
    );

    return NextResponse.json({ payments: paymentsWithDetails });
  } catch (error: any) {
    console.error('[GET /api/payments/[counteragentUuid]/payment-options] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch payment options' },
      { status: 500 }
    );
  }
}
