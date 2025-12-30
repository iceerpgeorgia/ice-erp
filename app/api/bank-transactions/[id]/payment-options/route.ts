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

    // Get all payments for this counteragent
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

    return NextResponse.json({ payments });
  } catch (error: any) {
    console.error("[GET /api/bank-transactions/[id]/payment-options] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch payment options" },
      { status: 500 }
    );
  }
}
