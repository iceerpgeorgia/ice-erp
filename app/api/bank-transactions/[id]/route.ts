import { NextRequest, NextResponse } from "next/server";
import { Pool } from 'pg';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

// Use Supabase connection for consolidated_bank_accounts table
const getSupabasePool = () => new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.REMOTE_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

/**
 * Calculate exchange rate and nominal amount based on currencies and date
 * Formula: nominal_amount = round(account_currency_amount * (1/exchange_rate), 2)
 */
async function calculateExchangeRateAndAmount(
  accountCurrencyUuid: string,
  nominalCurrencyUuid: string,
  accountAmount: any,
  transactionDate: string,
  correctionDate: any = null
): Promise<{ exchangeRate: Decimal; nominalAmount: Decimal } | null> {
  try {
    // Get currency codes
    const [accountCurrency, nominalCurrency] = await Promise.all([
      prisma.$queryRaw<Array<{ code: string }>>`
        SELECT code FROM currencies WHERE uuid = ${accountCurrencyUuid}::uuid LIMIT 1
      `,
      prisma.$queryRaw<Array<{ code: string }>>`
        SELECT code FROM currencies WHERE uuid = ${nominalCurrencyUuid}::uuid LIMIT 1
      `
    ]);

    if (accountCurrency.length === 0 || nominalCurrency.length === 0) {
      console.warn('[calculateExchangeRateAndAmount] Currency not found');
      return null;
    }

    const accountCode = accountCurrency[0].code;
    const nominalCode = nominalCurrency[0].code;

    // If same currency, exchange rate is 1
    if (accountCode === nominalCode) {
      return {
        exchangeRate: new Decimal(1),
        nominalAmount: new Decimal(accountAmount.toString())
      };
    }

    // Use correction_date if provided, otherwise transaction_date
    const effectiveDate = correctionDate 
      ? new Date(correctionDate).toISOString().split('T')[0]
      : new Date(transactionDate.split('.').reverse().join('-')).toISOString().split('T')[0];

    console.log(`[calculateExchangeRateAndAmount] ${accountCode} → ${nominalCode} on ${effectiveDate}`);

    // For GEL base currency, fetch the rate from nbg_exchange_rates
    if (accountCode === 'GEL') {
      // GEL → Foreign: rate is the foreign currency rate
      const rates = await prisma.$queryRaw<Array<any>>`
        SELECT * FROM nbg_exchange_rates WHERE date = ${effectiveDate}::date LIMIT 1
      `;

      if (rates.length === 0) {
        console.warn(`[calculateExchangeRateAndAmount] No exchange rate found for ${effectiveDate}`);
        return null;
      }

      const rateField = nominalCode.toLowerCase();
      const rate = rates[0][rateField];

      if (!rate) {
        console.warn(`[calculateExchangeRateAndAmount] Rate field ${rateField} not found`);
        return null;
      }

      const exchangeRate = new Decimal(rate.toString());
      const nominalAmount = new Decimal(accountAmount.toString())
        .mul(new Decimal(1).div(exchangeRate))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      console.log(`[calculateExchangeRateAndAmount] Rate: ${exchangeRate}, Amount: ${accountAmount} * (1/${exchangeRate}) = ${nominalAmount}`);

      return { exchangeRate, nominalAmount };
    } else if (nominalCode === 'GEL') {
      // Foreign → GEL: rate is the account currency rate
      const rates = await prisma.$queryRaw<Array<any>>`
        SELECT * FROM nbg_exchange_rates WHERE date = ${effectiveDate}::date LIMIT 1
      `;

      if (rates.length === 0) {
        console.warn(`[calculateExchangeRateAndAmount] No exchange rate found for ${effectiveDate}`);
        return null;
      }

      const rateField = accountCode.toLowerCase();
      const rate = rates[0][rateField];

      if (!rate) {
        console.warn(`[calculateExchangeRateAndAmount] Rate field ${rateField} not found`);
        return null;
      }

      const exchangeRate = new Decimal(rate.toString());
      const nominalAmount = new Decimal(accountAmount.toString())
        .mul(exchangeRate)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      console.log(`[calculateExchangeRateAndAmount] Rate: ${exchangeRate}, Amount: ${accountAmount} * ${exchangeRate} = ${nominalAmount}`);

      return { exchangeRate, nominalAmount };
    } else {
      // Foreign → Foreign: convert through GEL
      const rates = await prisma.$queryRaw<Array<any>>`
        SELECT * FROM nbg_exchange_rates WHERE date = ${effectiveDate}::date LIMIT 1
      `;

      if (rates.length === 0) {
        console.warn(`[calculateExchangeRateAndAmount] No exchange rate found for ${effectiveDate}`);
        return null;
      }

      const accountRateField = accountCode.toLowerCase();
      const nominalRateField = nominalCode.toLowerCase();
      const accountRate = rates[0][accountRateField];
      const nominalRate = rates[0][nominalRateField];

      if (!accountRate || !nominalRate) {
        console.warn(`[calculateExchangeRateAndAmount] Rate fields not found`);
        return null;
      }

      // Cross rate: (account to GEL) / (nominal to GEL) = account to nominal
      const exchangeRate = new Decimal(accountRate.toString()).div(new Decimal(nominalRate.toString()));
      const nominalAmount = new Decimal(accountAmount.toString())
        .mul(new Decimal(1).div(exchangeRate))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      console.log(`[calculateExchangeRateAndAmount] Cross rate: ${accountRate}/${nominalRate} = ${exchangeRate}, Amount: ${nominalAmount}`);

      return { exchangeRate, nominalAmount };
    }
  } catch (error) {
    console.error('[calculateExchangeRateAndAmount] Error:', error);
    return null;
  }
}

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
      counteragentUuid: current.counteragent_uuid,
      projectUuid: current.project_uuid,
      financialCodeUuid: current.financial_code_uuid,
      nominalCurrencyUuid: current.nominal_currency_uuid,
      nominalAmount: current.nominal_amount?.toString(),
      paymentId: current.payment_id,
      accountCurrencyAmount: current.account_currency_amount?.toString(),
      accountCurrencyUuid: current.account_currency_uuid,
      transactionDate: current.transaction_date,
    });
    console.log(`[PATCH] Field types:`, {
      nominalAmount: typeof current.nominal_amount,
      accountCurrencyAmount: typeof current.account_currency_amount,
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

    console.log('[PATCH] Checking fields for changes:');
    console.log(`  - counteragent_uuid: ${counteragent_uuid} vs ${current.counteragent_uuid} (${counteragent_uuid !== undefined && counteragent_uuid !== current.counteragent_uuid})`);
    console.log(`  - payment_uuid: ${payment_uuid} vs ${current.payment_id} (${payment_uuid !== undefined && payment_uuid !== current.payment_id})`);
    console.log(`  - project_uuid: ${project_uuid} vs ${current.project_uuid}`);
    console.log(`  - financial_code_uuid: ${financial_code_uuid} vs ${current.financial_code_uuid}`);
    console.log(`  - nominal_currency_uuid: ${nominal_currency_uuid} vs ${current.nominal_currency_uuid}`);

    // Track changes
    if (counteragent_uuid !== undefined && counteragent_uuid !== current.counteragent_uuid) {
      updateData.counteragentUuid = counteragent_uuid;
      changes.push(`counteragent: ${current.counteragent_uuid} → ${counteragent_uuid}`);
    }
    
    // Handle payment_uuid change - this triggers currency and amount recalculation
    if (payment_uuid !== undefined && payment_uuid !== current.payment_id) {
      console.log('[PATCH] Payment ID is changing, will recalculate nominal amount');
      updateData.paymentId = payment_uuid;
      changes.push(`payment_id: ${current.payment_id} → ${payment_uuid}`);
      
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
            changes.push(`nominal_currency: ${current.nominal_currency_uuid} → ${payment.currencyUuid} (from payment)`);
            
            // Calculate exchange rate and nominal amount
            const result = await calculateExchangeRateAndAmount(
              current.account_currency_uuid,
              payment.currencyUuid,
              current.account_currency_amount,
              current.transaction_date,
              current.correction_date
            );
            
            if (result) {
              updateData.exchangeRate = result.exchangeRate;
              updateData.nominalAmount = result.nominalAmount;
              changes.push(`exchange_rate: ${current.exchange_rate?.toString()} → ${result.exchangeRate.toString()}`);
              changes.push(`nominal_amount: ${current.nominal_amount?.toString()} → ${result.nominalAmount.toString()} (recalculated)`);
            }
          }
        } catch (error) {
          console.error('[PATCH] Error processing payment currency change:', error);
          // Continue with update even if calculation fails
        }
      } else {
        // Payment cleared - reset to account currency with exchange rate 1
        updateData.nominalCurrencyUuid = current.account_currency_uuid;
        updateData.nominalAmount = current.account_currency_amount;
        updateData.exchangeRate = new Decimal(1);
        changes.push(`nominal_currency: ${current.nominal_currency_uuid} → ${current.account_currency_uuid} (cleared payment)`);
        changes.push(`exchange_rate: ${current.exchange_rate?.toString()} → 1.0000000000 (same currency)`);
        changes.push(`nominal_amount: ${current.nominal_amount?.toString()} → ${current.account_currency_amount.toString()} (cleared payment)`);
      }
    }
    
    if (project_uuid !== undefined && project_uuid !== current.project_uuid) {
      updateData.projectUuid = project_uuid;
      changes.push(`project: ${current.project_uuid} → ${project_uuid}`);
    }
    if (financial_code_uuid !== undefined && financial_code_uuid !== current.financial_code_uuid) {
      updateData.financialCodeUuid = financial_code_uuid;
      changes.push(`financial_code: ${current.financial_code_uuid} → ${financial_code_uuid}`);
    }
    
    // Handle manual nominal currency change (only if not already set by payment change)
    if (nominal_currency_uuid !== undefined && 
        nominal_currency_uuid !== current.nominal_currency_uuid && 
        !updateData.nominalCurrencyUuid) {
      updateData.nominalCurrencyUuid = nominal_currency_uuid;
      changes.push(`nominal_currency: ${current.nominal_currency_uuid} → ${nominal_currency_uuid} (manual)`);
      
      // Recalculate exchange rate and amount
      const result = await calculateExchangeRateAndAmount(
        current.account_currency_uuid,
        nominal_currency_uuid,
        current.account_currency_amount,
        current.transaction_date,
        current.correction_date
      );
      
      if (result) {
        updateData.exchangeRate = result.exchangeRate;
        updateData.nominalAmount = result.nominalAmount;
        changes.push(`exchange_rate: ${current.exchange_rate?.toString()} → ${result.exchangeRate.toString()}`);
        changes.push(`nominal_amount: ${current.nominal_amount?.toString()} → ${result.nominalAmount.toString()} (recalculated)`);
      }
    }
    
    // Explicit nominal amount update (manual override) - only if not already calculated
    if (nominal_amount !== undefined && !updateData.nominalAmount) {
      const newAmount = nominal_amount ? new Decimal(nominal_amount) : null;
      const currentAmount = current.nominal_amount?.toString() || null;
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
    console.log(`[PATCH] Update data to be applied:`, JSON.stringify(updateData, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    // Update the record - convert id to BigInt for Prisma
    const updated = await prisma.consolidatedBankAccount.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    console.log(`[PATCH /bank-transactions/${params.id}] ✓ Update successful`);
    console.log('[PATCH] Updated state:', {
      id: updated.id.toString(),
      counteragentUuid: updated.counteragentUuid,
      projectUuid: updated.projectUuid,
      financialCodeUuid: updated.financialCodeUuid,
      nominalCurrencyUuid: updated.nominalCurrencyUuid,
      nominalAmount: updated.nominalAmount?.toString(),
      paymentId: updated.paymentId,
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
  } finally {
    await pool.end();
  }
}
