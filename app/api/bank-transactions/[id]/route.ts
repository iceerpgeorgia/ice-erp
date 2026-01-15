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

    console.log(`[PATCH /bank-transactions/${params.id}] Update request received`);
    console.log('[PATCH] Request body:', JSON.stringify(body, null, 2));

    // Get current transaction
    const current = await prisma.consolidatedBankAccount.findUnique({
      where: { id },
    });

    if (!current) {
      console.log(`[PATCH /bank-transactions/${params.id}] Transaction not found`);
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    console.log(`[PATCH /bank-transactions/${params.id}] Current state:`, {
      counteragentUuid: current.counteragentUuid,
      projectUuid: current.projectUuid,
      financialCodeUuid: current.financialCodeUuid,
      nominalCurrencyUuid: current.nominalCurrencyUuid,
      nominalAmount: current.nominalAmount?.toString(),
    });

    const {
      counteragent_uuid,
      project_uuid,
      financial_code_uuid,
      nominal_currency_uuid,
      nominal_amount,
    } = body;

    const updateData: any = {};
    const changes: string[] = [];

    // Track changes
    if (counteragent_uuid !== undefined && counteragent_uuid !== current.counteragentUuid) {
      updateData.counteragentUuid = counteragent_uuid;
      changes.push(`counteragent: ${current.counteragentUuid} → ${counteragent_uuid}`);
    }
    if (project_uuid !== undefined && project_uuid !== current.projectUuid) {
      updateData.projectUuid = project_uuid;
      changes.push(`project: ${current.projectUuid} → ${project_uuid}`);
    }
    if (financial_code_uuid !== undefined && financial_code_uuid !== current.financialCodeUuid) {
      updateData.financialCodeUuid = financial_code_uuid;
      changes.push(`financial_code: ${current.financialCodeUuid} → ${financial_code_uuid}`);
    }
    if (nominal_currency_uuid !== undefined && nominal_currency_uuid !== current.nominalCurrencyUuid) {
      updateData.nominalCurrencyUuid = nominal_currency_uuid;
      changes.push(`nominal_currency: ${current.nominalCurrencyUuid} → ${nominal_currency_uuid}`);
    }
    if (nominal_amount !== undefined) {
      const newAmount = nominal_amount ? new Decimal(nominal_amount) : null;
      const currentAmount = current.nominalAmount?.toString() || null;
      const newAmountStr = newAmount?.toString() || null;
      if (currentAmount !== newAmountStr) {
        updateData.nominalAmount = newAmount;
        changes.push(`nominal_amount: ${currentAmount} → ${newAmountStr}`);
      }
    }

    if (changes.length === 0) {
      console.log(`[PATCH /bank-transactions/${params.id}] No changes detected`);
      return NextResponse.json({
        success: true,
        message: "No changes to apply",
        id: Number(current.id),
      });
    }

    console.log(`[PATCH /bank-transactions/${params.id}] Applying ${changes.length} changes:`, changes);

    // Update the record
    const updated = await prisma.consolidatedBankAccount.update({
      where: { id },
      data: updateData,
    });

    console.log(`[PATCH /bank-transactions/${params.id}] ✓ Update successful`);
    console.log('[PATCH] Updated state:', {
      counteragentUuid: updated.counteragentUuid,
      projectUuid: updated.projectUuid,
      financialCodeUuid: updated.financialCodeUuid,
      nominalCurrencyUuid: updated.nominalCurrencyUuid,
      nominalAmount: updated.nominalAmount?.toString(),
    });

    return NextResponse.json({
      success: true,
      message: "Transaction updated successfully",
      id: Number(updated.id),
      changes,
    });
  } catch (error: any) {
    console.error("[PATCH /api/bank-transactions/[id]] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update transaction" },
      { status: 500 }
    );
  }
}
