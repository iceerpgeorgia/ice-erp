import { NextRequest, NextResponse } from "next/server";
import { Pool } from 'pg';

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

    console.log(`[PATCH /bank-transactions/${id}] Update request received (Supabase)`);
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

    console.log(`[PATCH /bank-transactions/${id}] Current state:`, {
      counteragent_uuid: current.counteragent_uuid,
      project_uuid: current.project_uuid,
      financial_code_uuid: current.financial_code_uuid,
      nominal_currency_uuid: current.nominal_currency_uuid,
      nominal_amount: current.nominal_amount,
      payment_id: current.payment_id,
    });

    const {
      counteragent_uuid,
      project_uuid,
      financial_code_uuid,
      nominal_currency_uuid,
      nominal_amount,
      payment_uuid,
    } = body;

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    const changes: string[] = [];
    let paramIndex = 1;

    // Track changes for counteragent
    if (counteragent_uuid !== undefined && counteragent_uuid !== current.counteragent_uuid) {
      updateFields.push(`counteragent_uuid = $${paramIndex++}`);
      updateValues.push(counteragent_uuid);
      changes.push(`counteragent: ${current.counteragent_uuid} → ${counteragent_uuid}`);
    }
    
    // Handle payment_uuid change - this triggers currency and amount recalculation
    if (payment_uuid !== undefined && payment_uuid !== current.payment_id) {
      updateFields.push(`payment_id = $${paramIndex++}`);
      updateValues.push(payment_uuid);
      changes.push(`payment_id: ${current.payment_id} → ${payment_uuid}`);
      
      // When payment changes, update nominal currency and recalculate amount
      if (payment_uuid) {
        try {
          // Get payment's currency
          const paymentResult = await pool.query(
            'SELECT currency_uuid FROM payments WHERE payment_id = $1',
            [payment_uuid]
          );
          
          if (paymentResult.rows.length > 0 && paymentResult.rows[0].currency_uuid) {
            const paymentCurrencyUuid = paymentResult.rows[0].currency_uuid;
            
            // Update nominal currency to match payment currency
            updateFields.push(`nominal_currency_uuid = $${paramIndex++}`);
            updateValues.push(paymentCurrencyUuid);
            changes.push(`nominal_currency: ${current.nominal_currency_uuid} → ${paymentCurrencyUuid} (from payment)`);
            
            // Recalculate nominal amount with new currency
            const transactionDate = new Date(current.transaction_date.split('.').reverse().join('-'));
            const dateStr = transactionDate.toISOString().split('T')[0];
            
            // Get account currency code
            const accountCurrencyResult = await pool.query(
              'SELECT code FROM currencies WHERE uuid = $1 LIMIT 1',
              [current.account_currency_uuid]
            );
            
            // Get payment (nominal) currency code
            const nominalCurrencyResult = await pool.query(
              'SELECT code FROM currencies WHERE uuid = $1 LIMIT 1',
              [paymentCurrencyUuid]
            );
            
            if (accountCurrencyResult.rows.length > 0 && nominalCurrencyResult.rows.length > 0) {
              const accountCode = accountCurrencyResult.rows[0].code;
              const nominalCode = nominalCurrencyResult.rows[0].code;
              
              console.log(`[PATCH] Recalculating amount: ${accountCode} → ${nominalCode}`);
              
              if (accountCode === nominalCode) {
                // Same currency - no conversion needed
                updateFields.push(`nominal_amount = $${paramIndex++}`);
                updateValues.push(current.account_currency_amount);
                changes.push(`nominal_amount: ${current.nominal_amount} → ${current.account_currency_amount} (same currency)`);
              } else {
                // Different currencies - need exchange rate
                const ratesResult = await pool.query(
                  'SELECT * FROM nbg_exchange_rates WHERE date = $1::date LIMIT 1',
                  [dateStr]
                );
                
                if (ratesResult.rows.length > 0) {
                  const rate = ratesResult.rows[0];
                  let calculatedAmount = parseFloat(current.account_currency_amount);
                  
                  // Calculate based on currency pair
                  if (accountCode === 'GEL' && nominalCode !== 'GEL') {
                    // GEL → Foreign: divide by rate
                    const rateField = `${nominalCode.toLowerCase()}_rate`;
                    if (rate[rateField]) {
                      calculatedAmount = parseFloat(current.account_currency_amount) / parseFloat(rate[rateField]);
                      console.log(`[PATCH] GEL → ${nominalCode}: ${current.account_currency_amount} / ${rate[rateField]} = ${calculatedAmount}`);
                    }
                  } else if (accountCode !== 'GEL' && nominalCode === 'GEL') {
                    // Foreign → GEL: multiply by rate
                    const rateField = `${accountCode.toLowerCase()}_rate`;
                    if (rate[rateField]) {
                      calculatedAmount = parseFloat(current.account_currency_amount) * parseFloat(rate[rateField]);
                      console.log(`[PATCH] ${accountCode} → GEL: ${current.account_currency_amount} * ${rate[rateField]} = ${calculatedAmount}`);
                    }
                  } else if (accountCode !== 'GEL' && nominalCode !== 'GEL') {
                    // Foreign → Foreign: convert through GEL
                    const accountRateField = `${accountCode.toLowerCase()}_rate`;
                    const nominalRateField = `${nominalCode.toLowerCase()}_rate`;
                    if (rate[accountRateField] && rate[nominalRateField]) {
                      const gelAmount = parseFloat(current.account_currency_amount) * parseFloat(rate[accountRateField]);
                      calculatedAmount = gelAmount / parseFloat(rate[nominalRateField]);
                      console.log(`[PATCH] ${accountCode} → ${nominalCode}: ${current.account_currency_amount} * ${rate[accountRateField]} / ${rate[nominalRateField]} = ${calculatedAmount}`);
                    }
                  }
                  
                  updateFields.push(`nominal_amount = $${paramIndex++}`);
                  updateValues.push(calculatedAmount.toFixed(2));
                  changes.push(`nominal_amount: ${current.nominal_amount} → ${calculatedAmount.toFixed(2)} (recalculated from payment currency)`);
                } else {
                  console.warn(`[PATCH] No exchange rate found for ${dateStr}`);
                  // No rate available - use account amount as fallback
                  updateFields.push(`nominal_amount = $${paramIndex++}`);
                  updateValues.push(current.account_currency_amount);
                  changes.push(`nominal_amount: ${current.nominal_amount} → ${current.account_currency_amount} (no rate available)`);
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
        updateFields.push(`nominal_currency_uuid = $${paramIndex++}`);
        updateValues.push(current.account_currency_uuid);
        updateFields.push(`nominal_amount = $${paramIndex++}`);
        updateValues.push(current.account_currency_amount);
        changes.push(`nominal_currency: ${current.nominal_currency_uuid} → ${current.account_currency_uuid} (cleared payment)`);
        changes.push(`nominal_amount: ${current.nominal_amount} → ${current.account_currency_amount} (cleared payment)`);
      }
    }
    
    // Project change
    if (project_uuid !== undefined && project_uuid !== current.project_uuid) {
      updateFields.push(`project_uuid = $${paramIndex++}`);
      updateValues.push(project_uuid);
      changes.push(`project: ${current.project_uuid} → ${project_uuid}`);
    }
    
    // Financial code change
    if (financial_code_uuid !== undefined && financial_code_uuid !== current.financial_code_uuid) {
      updateFields.push(`financial_code_uuid = $${paramIndex++}`);
      updateValues.push(financial_code_uuid);
      changes.push(`financial_code: ${current.financial_code_uuid} → ${financial_code_uuid}`);
    }

    if (changes.length === 0) {
      console.log(`[PATCH /bank-transactions/${id}] No changes detected`);
      await pool.end();
      return NextResponse.json({
        success: true,
        message: "No changes to apply",
        id: parseInt(id),
      });
    }

    console.log(`[PATCH /bank-transactions/${id}] Applying ${changes.length} changes:`, changes);

    // Build and execute UPDATE query
    updateFields.push('updated_at = NOW()');
    updateValues.push(id);
    const updateQuery = `
      UPDATE consolidated_bank_accounts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    console.log('[PATCH] Update query:', updateQuery);
    console.log('[PATCH] Update values:', updateValues);

    const updateResult = await pool.query(updateQuery, updateValues);
    const updated = updateResult.rows[0];

    console.log(`[PATCH /bank-transactions/${id}] ✓ Update successful`);
    console.log('[PATCH] Updated state:', {
      counteragent_uuid: updated.counteragent_uuid,
      project_uuid: updated.project_uuid,
      financial_code_uuid: updated.financial_code_uuid,
      nominal_currency_uuid: updated.nominal_currency_uuid,
      nominal_amount: updated.nominal_amount,
      payment_id: updated.payment_id,
    });

    await pool.end();
    return NextResponse.json({
      success: true,
      message: "Transaction updated successfully",
      id: parseInt(id),
      changes,
    });
  } catch (error: any) {
    console.error("[PATCH /api/bank-transactions/[id]] Error:", error);
    try {
      await pool.end();
    } catch (e) {
      console.error("Error closing pool:", e);
    }
    return NextResponse.json(
      { error: error?.message || "Failed to update transaction" },
      { status: 500 }
    );
  }
}
