import { NextRequest, NextResponse } from "next/server";
import { Pool } from 'pg';
import { Decimal } from '@prisma/client/runtime/library';

export const revalidate = 0;

// Use Supabase connection for consolidated_bank_accounts table
const getSupabasePool = () => new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.REMOTE_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = getSupabasePool();
  
  try {
    const id = params.id;
    const body = await req.json();

    console.log(`[PATCH /bank-transactions/${id}] Update request received`);
    console.log('[PATCH] Request body:', JSON.stringify(body, null, 2));

    // Get current transaction from Supabase
    const currentResult = await pool.query(
      `SELECT * FROM consolidated_bank_accounts WHERE id = $1`,
      [id]
    );

    if (currentResult.rows.length === 0) {
      console.log(`[PATCH /bank-transactions/${id}] Transaction not found`);
      await pool.end();
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }
    
    const current = currentResult.rows[0];

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
    
    // Handle payment_uuid change - this triggers currency and amount recalculation
    if (payment_uuid !== undefined && payment_uuid !== current.paymentId) {
      updateData.paymentId = payment_uuid;
      changes.push(`payment_id: ${current.paymentId} → ${payment_uuid}`);
      
      // When payment changes, update nominal currency and recalculate amount
      if (payment_uuid) {
        try {
          // Get payment's currency
          const payment = await prisma.payment.findUnique({
            where: { paymentId: payment_uuid },
            select: { currencyUuid: true }
          });
          
          if (payment && payment.currencyUuid) {
            // Update nominal currency to match payment currency
            updateData.nominalCurrencyUuid = payment.currencyUuid;
            changes.push(`nominal_currency: ${current.nominalCurrencyUuid} → ${payment.currencyUuid} (from payment)`);
            
            // Recalculate nominal amount with new currency
            const transactionDate = new Date(current.transactionDate.split('.').reverse().join('-'));
            const dateStr = transactionDate.toISOString().split('T')[0];
            
            // Get account currency code
            const accountCurrency = await prisma.$queryRaw<Array<{ code: string }>>`
              SELECT code FROM currencies WHERE uuid = ${current.accountCurrencyUuid}::uuid LIMIT 1
            `;
            
            // Get payment (nominal) currency code
            const nominalCurrency = await prisma.$queryRaw<Array<{ code: string }>>`
              SELECT code FROM currencies WHERE uuid = ${payment.currencyUuid}::uuid LIMIT 1
            `;
            
            if (accountCurrency.length > 0 && nominalCurrency.length > 0) {
              const accountCode = accountCurrency[0].code;
              const nominalCode = nominalCurrency[0].code;
              
              console.log(`[PATCH] Recalculating amount: ${accountCode} → ${nominalCode}`);
              
              if (accountCode === nominalCode) {
                // Same currency - no conversion needed
                updateData.nominalAmount = current.accountCurrencyAmount;
                changes.push(`nominal_amount: ${current.nominalAmount?.toString()} → ${current.accountCurrencyAmount.toString()} (same currency)`);
              } else {
                // Different currencies - need exchange rate
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
                      console.log(`[PATCH] GEL → ${nominalCode}: ${current.accountCurrencyAmount} / ${rate[rateField]} = ${calculatedAmount}`);
                    }
                  } else if (accountCode !== 'GEL' && nominalCode === 'GEL') {
                    // Foreign → GEL: multiply by rate
                    const rateField = `${accountCode.toLowerCase()}Rate`;
                    if (rate[rateField]) {
                      calculatedAmount = new Decimal(current.accountCurrencyAmount.toString()).mul(new Decimal(rate[rateField].toString()));
                      console.log(`[PATCH] ${accountCode} → GEL: ${current.accountCurrencyAmount} * ${rate[rateField]} = ${calculatedAmount}`);
                    }
                  } else if (accountCode !== 'GEL' && nominalCode !== 'GEL') {
                    // Foreign → Foreign: convert through GEL
                    const accountRateField = `${accountCode.toLowerCase()}Rate`;
                    const nominalRateField = `${nominalCode.toLowerCase()}Rate`;
                    if (rate[accountRateField] && rate[nominalRateField]) {
                      const gelAmount = new Decimal(current.accountCurrencyAmount.toString()).mul(new Decimal(rate[accountRateField].toString()));
                      calculatedAmount = gelAmount.div(new Decimal(rate[nominalRateField].toString()));
                      console.log(`[PATCH] ${accountCode} → ${nominalCode}: ${current.accountCurrencyAmount} * ${rate[accountRateField]} / ${rate[nominalRateField]} = ${calculatedAmount}`);
                    }
                  }
                  
                  updateData.nominalAmount = calculatedAmount;
                  changes.push(`nominal_amount: ${current.nominalAmount?.toString()} → ${calculatedAmount.toString()} (recalculated from payment currency)`);
                } else {
                  console.warn(`[PATCH] No exchange rate found for ${dateStr}`);
                  // No rate available - use account amount as fallback
                  updateData.nominalAmount = current.accountCurrencyAmount;
                  changes.push(`nominal_amount: ${current.nominalAmount?.toString()} → ${current.accountCurrencyAmount.toString()} (no rate available)`);
                }
              }
            }
          }
        } catch (error) {
          console.error('[PATCH] Error processing payment currency change:', error);
          // Continue with update even if calculation fails
        }
      } else {
        // Payment cleared - reset to account currency
        updateData.nominalCurrencyUuid = current.accountCurrencyUuid;
        updateData.nominalAmount = current.accountCurrencyAmount;
        changes.push(`nominal_currency: ${current.nominalCurrencyUuid} → ${current.accountCurrencyUuid} (cleared payment)`);
        changes.push(`nominal_amount: ${current.nominalAmount?.toString()} → ${current.accountCurrencyAmount.toString()} (cleared payment)`);
      }
    }
    
    if (project_uuid !== undefined && project_uuid !== current.projectUuid) {
      updateData.projectUuid = project_uuid;
      changes.push(`project: ${current.projectUuid} → ${project_uuid}`);
    }
    if (financial_code_uuid !== undefined && financial_code_uuid !== current.financialCodeUuid) {
      updateData.financialCodeUuid = financial_code_uuid;
      changes.push(`financial_code: ${current.financialCodeUuid} → ${financial_code_uuid}`);
    }
    
    // Handle manual nominal currency change (only if not already set by payment change)
    if (nominal_currency_uuid !== undefined && 
        nominal_currency_uuid !== current.nominalCurrencyUuid && 
        !updateData.nominalCurrencyUuid) {
      updateData.nominalCurrencyUuid = nominal_currency_uuid;
      changes.push(`nominal_currency: ${current.nominalCurrencyUuid} → ${nominal_currency_uuid} (manual)`);
      
      // If currency changed manually, recalculate nominal amount using exchange rates
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
        // Same currency or cleared - use account amount (only if not already set by payment)
        if (!updateData.nominalAmount) {
          updateData.nominalAmount = current.accountCurrencyAmount;
          changes.push(`nominal_amount: ${current.nominalAmount?.toString()} → ${current.accountCurrencyAmount.toString()} (same currency, manual)`);
        }
      }
    }
    
    // Explicit nominal amount update (manual override) - only if not already calculated
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
