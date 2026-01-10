import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from '@prisma/client/runtime/library';

export const revalidate = 0;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = BigInt(params.id);
    const body = await req.json();

    // Get current transaction
    const current = await prisma.consolidatedBankAccount.findUnique({
      where: { id },
    });

    if (!current) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    const {
      counteragent_uuid,
      project_uuid,
      financial_code_uuid,
      nominal_currency_uuid,
      nominal_amount,
    } = body;

    const updateData: any = {};

    // Allow manual field updates
    if (counteragent_uuid !== undefined) updateData.counteragentUuid = counteragent_uuid;
    if (project_uuid !== undefined) updateData.projectUuid = project_uuid;
    if (financial_code_uuid !== undefined) updateData.financialCodeUuid = financial_code_uuid;
    if (nominal_currency_uuid !== undefined) updateData.nominalCurrencyUuid = nominal_currency_uuid;
    if (nominal_amount !== undefined) updateData.nominalAmount = nominal_amount ? new Decimal(nominal_amount) : null;

    // Update the record
    const updated = await prisma.consolidatedBankAccount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Transaction updated successfully",
      id: Number(updated.id),
    });
  } catch (error: any) {
    console.error("[PATCH /api/bank-transactions/[id]] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update transaction" },
      { status: 500 }
    );
  }
}
