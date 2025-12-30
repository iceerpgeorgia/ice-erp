import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = BigInt(params.id);
    const body = await req.json();

    // Extract allowed fields for update
    const {
      counteragent_uuid,
      project_uuid,
      financial_code_uuid,
      payment_uuid,
      nominal_currency_uuid,
      description,
      date,
      correction_date
    } = body;

    // Build update data object with only provided fields
    const updateData: any = {};
    
    if (counteragent_uuid !== undefined) updateData.counteragentUuid = counteragent_uuid;
    if (project_uuid !== undefined) updateData.projectUuid = project_uuid;
    if (financial_code_uuid !== undefined) updateData.financialCodeUuid = financial_code_uuid;
    if (payment_uuid !== undefined) updateData.paymentUuid = payment_uuid;
    if (nominal_currency_uuid !== undefined) updateData.nominalCurrencyUuid = nominal_currency_uuid;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = new Date(date);
    if (correction_date !== undefined) updateData.correctionDate = correction_date ? new Date(correction_date) : null;

    // Update the record - triggers will handle related updates
    const updated = await prisma.consolidatedBankAccount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Transaction updated successfully",
      id: Number(updated.id)
    });
  } catch (error: any) {
    console.error("[PATCH /api/bank-transactions/[id]] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update transaction" },
      { status: 500 }
    );
  }
}
