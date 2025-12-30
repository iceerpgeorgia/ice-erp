import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const payments = await prisma.payment.findMany({
      where: {
        counteragentUuid: transaction.counteragentUuid,
        isActive: true,
      },
      select: {
        paymentId: true,
        projectUuid: true,
        financialCodeUuid: true,
        currencyUuid: true,
      },
      orderBy: {
        paymentId: 'asc',
      },
    });

    // Fetch related data for each payment
    const paymentsWithDetails = await Promise.all(
      payments.map(async (payment) => {
        const [currency, project, financialCode] = await Promise.all([
          payment.currencyUuid
            ? prisma.currency.findUnique({
                where: { uuid: payment.currencyUuid },
                select: { code: true },
              })
            : null,
          payment.projectUuid
            ? prisma.project.findUnique({
                where: { uuid: payment.projectUuid },
                select: { name: true },
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
          currencyCode: currency?.code || '',
          projectName: project?.name || '',
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
