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
      payment_uuid,
    } = body;

    const updateData: any = {};
    const changes: string[] = [];

    // Track changes
    if (counteragent_uuid !== undefined && counteragent_uuid !== current.counteragentUuid) {
      updateData.counteragentUuid = counteragent_uuid;
      changes.push(`counteragent: ${current.counteragentUuid} → ${counteragent_uuid}`);
    }
    
    if (payment_uuid !== undefined && payment_uuid !== current.paymentId) {
      updateData.paymentId = payment_uuid;
      changes.push(`payment_id: ${current.paymentId} → ${payment_uuid}`);
    }
    
    if (project_uuid !== undefined && project_uuid !== current.projectUuid) {
      updateData.projectUuid = project_uuid;
      changes.push(`project: ${current.projectUuid} → ${project_uuid}`);
    }
    if (financial_code_uuid !== undefined && financial_code_uuid !== current.financialCodeUuid) {
      updateData.financialCodeUuid = financial_code_uuid;
      changes.push(`financial_code: ${current.financialCodeUuid} → ${financial_code_uuid}`);
    }
    
    // Handle nominal currency change - may need to recalculate amount
    if (nominal_currency_uuid !== undefined && nominal_currency_uuid !== current.nominalCurrencyUuid) {
      updateData.nominalCurrencyUuid = nominal_currency_uuid;
      changes.push(`nominal_currency: ${current.nominalCurrencyUuid} → ${nominal_currency_uuid}`);
      
      // If currency changed, recalculate nominal amount using exchange rates
      if (nominal_currency_uuid && nominal_currency_uuid !== current.accountCurrencyUuid) {
        try {
          // Get transaction date and currencies
          const transactionDate = new Date(current.transactionDate.split('.').reverse().join('-'));
          const dateStr = transactionDate.toISOString().split('T')[0];
          
          // Get account currency code
          const accountCurrency = await prisma.$queryRaw<Array<{ code: string }>>`
            SELECT code FROM currencies WHERE uuid = ${current.accountCurrencyUuid}::uuid LIMIT 1
          `;
          
          // Get nominal currency code
          const nominalCurrency = await prisma.$queryRaw<Array<{ code: string }>>`
            SELECT code FROM currencies WHERE uuid = ${nominal_currency_uuid}::uuid LIMIT 1
          `;
          
          if (accountCurrency.length > 0 && nominalCurrency.length > 0) {
            const accountCode = accountCurrency[0].code;
            const nominalCode = nominalCurrency[0].code;
            
            // Get exchange rates for transaction date
            const rates = await prisma.$queryRaw<Array<any>>`
              SELECT * FROM nbg_exchange_rates 
              WHERE date = ${dateStr}::date LIMIT 1
            `;
            
            if (rates.length > 0) {
              const rate = rates[0];
              let calculatedAmount = current.accountCurrencyAmount;
              
              // Calculate based on currency pair
              if (accountCode === 'GEL' && nominalCode !== 'GEL') {
                // GEL → Foreign: divide by rate
                const rateField = `${nominalCode.toLowerCase()}Rate`;
                if (rate[rateField]) {
                  calculatedAmount = new Decimal(current.accountCurrencyAmount.toString()).div(new Decimal(rate[rateField].toString()));
                }
              } else if (accountCode !== 'GEL' && nominalCode === 'GEL') {
                // Foreign → GEL: multiply by rate  
                const rateField = `${accountCode.toLowerCase()}Rate`;
                if (rate[rateField]) {
                  calculatedAmount = new Decimal(current.accountCurrencyAmount.toString()).mul(new Decimal(rate[rateField].toString()));
                }
              } else if (accountCode !== 'GEL' && nominalCode !== 'GEL') {
                // Foreign → Foreign: convert through GEL
                const accountRateField = `${accountCode.toLowerCase()}Rate`;
                const nominalRateField = `${nominalCode.toLowerCase()}Rate`;
                if (rate[accountRateField] && rate[nominalRateField]) {
                  const gelAmount = new Decimal(current.accountCurrencyAmount.toString()).mul(new Decimal(rate[accountRateField].toString()));
                  calculatedAmount = gelAmount.div(new Decimal(rate[nominalRateField].toString()));
                }
              }
              
              updateData.nominalAmount = calculatedAmount;
              changes.push(`nominal_amount: ${current.nominalAmount?.toString()} → ${calculatedAmount.toString()} (recalculated)`);
            }
          }
        } catch (error) {
          console.error('[PATCH] Error calculating nominal amount:', error);
          // Continue with update even if calculation fails
        }
      } else if (!nominal_currency_uuid || nominal_currency_uuid === current.accountCurrencyUuid) {
        // Same currency or cleared - use account amount
        updateData.nominalAmount = current.accountCurrencyAmount;
        changes.push(`nominal_amount: ${current.nominalAmount?.toString()} → ${current.accountCurrencyAmount.toString()} (same currency)`);
      }
    }
    
    // Explicit nominal amount update (manual override)
    if (nominal_amount !== undefined && !updateData.nominalAmount) {
      const newAmount = nominal_amount ? new Decimal(nominal_amount) : null;
      const currentAmount = current.nominalAmount?.toString() || null;
      const newAmountStr = newAmount?.toString() || null;
      if (currentAmount !== newAmountStr) {
        updateData.nominalAmount = newAmount;
        changes.push(`nominal_amount: ${currentAmount} → ${newAmountStr} (manual)`);
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
