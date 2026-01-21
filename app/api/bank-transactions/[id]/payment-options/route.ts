import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[GET /api/bank-transactions/[id]/payment-options] Transaction ID:', params.id);
    const id = BigInt(params.id);
    
    // Get the transaction to find counteragent
    const transaction = await prisma.consolidatedBankAccount.findUnique({
      where: { id },
      select: { counteragentUuid: true },
    });

    if (!transaction || !transaction.counteragentUuid) {
      return NextResponse.json({ payments: [] });
    }

    // Get all payments for this counteragent with related data
    const payments = await prisma.payments.findMany({
      where: {
        counteragent_uuid: transaction.counteragentUuid,
        is_active: true,
      },
      select: {
        paymentId: true,
        projectUuid: true,
        financialCodeUuid: true,
        currencyUuid: true,
        jobUuid: true,
      },
      orderBy: {
        paymentId: 'asc',
      },
    });

    // Fetch related data for each payment
    const paymentsWithDetails = await Promise.all(
      payments.map(async (payment) => {
        // Fetch job with brand info separately if needed
        let job: any = null;
        if (payment.jobUuid) {
          console.log('[payment-options] Fetching job:', payment.jobUuid);
          try {
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
              WHERE j.job_uuid::text = ${payment.jobUuid}
              LIMIT 1
            `;
            job = jobRows[0] || null;
          } catch (jobError: any) {
            console.error('[payment-options] Error fetching job:', jobError.message);
            // Continue without job data
            job = null;
          }
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
          financialCodeUuid: payment.financialCodeUuid,
          currencyUuid: payment.currencyUuid,
          jobUuid: payment.jobUuid,
          currencyCode: currency?.code || '',
          projectName: project?.projectName || '',
          jobName: job?.job_name || '',
          jobDisplay: job?.job_display || '',
          financialCodeValidation: financialCode?.validation || '',
        };
      })
    );

    return NextResponse.json({ payments: paymentsWithDetails });
  } catch (error: any) {
    console.error("[GET /api/bank-transactions/[id]/payment-options] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch payment options" },
      { status: 500 }
    );
  }
}
