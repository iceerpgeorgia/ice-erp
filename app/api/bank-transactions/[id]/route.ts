import { NextRequest, NextResponse } from "next/server";
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const revalidate = 0;

const DEFAULT_TABLE = "GE78BG0000000893486000_BOG_GEL" as const;
const ALLOWED_TABLES = new Set([
  "GE78BG0000000893486000_BOG_GEL",
  "GE65TB7856036050100002_TBC_GEL",
]);
type AllowedTable = "GE78BG0000000893486000_BOG_GEL" | "GE65TB7856036050100002_TBC_GEL";

const TBC_OFFSET = 1000000000000n;
const BATCH_OFFSET = 2000000000000n;

function resolveTableName(searchParams: URLSearchParams): AllowedTable {
  const sourceTable = searchParams.get('sourceTable');
  if (sourceTable && ALLOWED_TABLES.has(sourceTable)) {
    return sourceTable as AllowedTable;
  }
  return DEFAULT_TABLE;
}

function resolveRecordId(paramId: string, searchParams: URLSearchParams): string {
  const sourceId = searchParams.get('sourceId');
  return sourceId && sourceId.trim() ? sourceId : paramId;
}

function resolveSyntheticId(rawId: bigint): { tableName: AllowedTable; recordId: bigint; isBatch: boolean } | null {
  if (rawId < 0n) return null;
  if (rawId >= BATCH_OFFSET) {
    const adjusted = rawId - BATCH_OFFSET;
    if (adjusted >= TBC_OFFSET) {
      return { tableName: "GE65TB7856036050100002_TBC_GEL", recordId: adjusted - TBC_OFFSET, isBatch: true };
    }
    return { tableName: "GE78BG0000000893486000_BOG_GEL", recordId: adjusted, isBatch: true };
  }
  if (rawId >= TBC_OFFSET) {
    return { tableName: "GE65TB7856036050100002_TBC_GEL", recordId: rawId - TBC_OFFSET, isBatch: false };
  }
  return { tableName: "GE78BG0000000893486000_BOG_GEL", recordId: rawId, isBatch: false };
}

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
    const getRateField = (code: string) => `${code.toLowerCase()}_rate`;

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

      const rateField = getRateField(nominalCode);
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

      const rateField = getRateField(accountCode);
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

      const accountRateField = getRateField(accountCode);
      const nominalRateField = getRateField(nominalCode);
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
  try {
    const searchParams = req.nextUrl.searchParams;
    const tableName = resolveTableName(searchParams);
    const recordId = resolveRecordId(params.id, searchParams);
    const idParam = /^\d+$/.test(recordId) ? BigInt(recordId) : recordId;
    const sourceIdParam = searchParams.get('sourceId');
    const sourceTableParam = searchParams.get('sourceTable');
    const body = await req.json();

    console.log(`[PATCH /bank-transactions/${params.id}] Update request received`);
    console.log('[PATCH] Query params:', {
      sourceTable: sourceTableParam,
      sourceId: sourceIdParam,
      resolvedTable: tableName,
      resolvedRecordId: recordId,
    });
    console.log('[PATCH] Request body:', JSON.stringify(body, null, 2));

    // Get current transaction from deconsolidated table
    const currentResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${tableName}" WHERE id = $1`,
      idParam
    );
    const currentRows = Array.isArray(currentResult)
      ? currentResult
      : (currentResult as { rows?: any[] })?.rows ?? [];

    if (currentRows.length === 0) {
      if (typeof idParam === 'bigint' && !sourceIdParam) {
        const fallback = resolveSyntheticId(idParam);
        if (fallback) {
          if (fallback.isBatch) {
            console.log(`[PATCH /bank-transactions/${params.id}] Batch partition detected; patch not supported in this endpoint.`);
            return NextResponse.json(
              { error: "Batch partition records cannot be patched via this endpoint." },
              { status: 400 }
            );
          }

          console.log(`[PATCH /bank-transactions/${params.id}] Retrying via synthetic id mapping`, {
            fallbackTable: fallback.tableName,
            fallbackRecordId: fallback.recordId.toString(),
          });

          const fallbackResult = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM "${fallback.tableName}" WHERE id = $1`,
            fallback.recordId
          );
          const fallbackRows = Array.isArray(fallbackResult)
            ? fallbackResult
            : (fallbackResult as { rows?: any[] })?.rows ?? [];

          if (fallbackRows.length === 0) {
            console.log(`[PATCH /bank-transactions/${params.id}] Transaction not found after synthetic fallback`);
            return NextResponse.json(
              { error: "Transaction not found" },
              { status: 404 }
            );
          }

          // Override resolved table/id for downstream updates
          (req as any).__resolvedTableName = fallback.tableName;
          (req as any).__resolvedRecordId = fallback.recordId;
          currentRows.splice(0, currentRows.length, fallbackRows[0]);
        } else {
          console.log(`[PATCH /bank-transactions/${params.id}] Transaction not found`);
          return NextResponse.json(
            { error: "Transaction not found" },
            { status: 404 }
          );
        }
      } else {
        console.log(`[PATCH /bank-transactions/${params.id}] Transaction not found`);
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }
    }
    
    const current = currentRows[0];
    const resolvedTableName = (req as any).__resolvedTableName ?? tableName;
    const resolvedRecordId = (req as any).__resolvedRecordId ?? idParam;

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
      correction_date,
      comment,
    } = body;

    const updateData: any = {};
    const changes: string[] = [];

    console.log('[PATCH] Checking fields for changes:');
    console.log(`  - counteragent_uuid: ${counteragent_uuid} vs ${current.counteragent_uuid} (${counteragent_uuid !== undefined && counteragent_uuid !== current.counteragent_uuid})`);
    console.log(`  - payment_uuid: ${payment_uuid} vs ${current.payment_id} (${payment_uuid !== undefined && payment_uuid !== current.payment_id})`);
    console.log(`  - project_uuid: ${project_uuid} vs ${current.project_uuid}`);
    console.log(`  - financial_code_uuid: ${financial_code_uuid} vs ${current.financial_code_uuid}`);
    console.log(`  - nominal_currency_uuid: ${nominal_currency_uuid} vs ${current.nominal_currency_uuid}`);
    console.log(`  - comment: ${comment} vs ${current.comment}`);

    // Track changes
    if (counteragent_uuid !== undefined && counteragent_uuid !== current.counteragent_uuid) {
      updateData.counteragentUuid = counteragent_uuid;
      changes.push(`counteragent: ${current.counteragent_uuid} → ${counteragent_uuid}`);
    }
    
    // Handle payment_uuid change - this triggers currency and amount recalculation
    if (payment_uuid !== undefined && payment_uuid !== current.payment_id) {
      console.log('[PATCH] Payment ID is changing, will recalculate nominal amount');
      const normalizedPaymentId = payment_uuid || null;
      updateData.paymentId = normalizedPaymentId;
      changes.push(`payment_id: ${current.payment_id} → ${payment_uuid}`);
      updateData.parsingLock = Boolean(normalizedPaymentId);
      changes.push(`parsing_lock: ${current.parsing_lock} → ${Boolean(normalizedPaymentId)} (payment override)`);
      
      // When payment changes, update nominal currency and recalculate amount
      if (normalizedPaymentId) {
        try {
          // Get payment's currency
          const payment = await prisma.payments.findUnique({
            where: { payment_id: normalizedPaymentId },
            select: { currency_uuid: true, counteragent_uuid: true }
          });
          
          if (payment && payment.currency_uuid) {
            // Update nominal currency to match payment currency
            updateData.nominalCurrencyUuid = payment.currency_uuid;
            changes.push(`nominal_currency: ${current.nominal_currency_uuid} → ${payment.currency_uuid} (from payment)`);
            
            // Calculate exchange rate and nominal amount
            const result = await calculateExchangeRateAndAmount(
              current.account_currency_uuid,
              payment.currency_uuid,
              current.account_currency_amount,
              current.transaction_date,
              correction_date ?? current.correction_date
            );
            
            if (result) {
              updateData.exchangeRate = result.exchangeRate;
              updateData.nominalAmount = result.nominalAmount;
              changes.push(`exchange_rate: ${current.exchange_rate?.toString()} → ${result.exchangeRate.toString()}`);
              changes.push(`nominal_amount: ${current.nominal_amount?.toString()} → ${result.nominalAmount.toString()} (recalculated)`);
            }
          }

          const shouldAutoAssignCounteragent =
            !current.counteragent_uuid &&
            counteragent_uuid === undefined &&
            payment?.counteragent_uuid;

          if (shouldAutoAssignCounteragent) {
            updateData.counteragentUuid = payment.counteragent_uuid;
            changes.push(`counteragent: ${current.counteragent_uuid} → ${payment.counteragent_uuid} (from payment)`);
          }
        } catch (error) {
          console.error('[PATCH] Error processing payment currency change:', error);
          // Continue with update even if calculation fails
        }
      } else {
        // Payment cleared - reset payment overrides to account currency baseline
        updateData.projectUuid = null;
        updateData.financialCodeUuid = null;
        updateData.nominalCurrencyUuid = current.account_currency_uuid;
        updateData.exchangeRate = new Decimal(1);
        updateData.nominalAmount = new Decimal(current.account_currency_amount?.toString?.() ?? current.account_currency_amount);
        changes.push('project_uuid: cleared (payment removed)');
        changes.push('financial_code_uuid: cleared (payment removed)');
        changes.push(`nominal_currency_uuid: ${current.nominal_currency_uuid} → ${current.account_currency_uuid} (cleared payment)`);
        changes.push(`exchange_rate: ${current.exchange_rate?.toString?.()} → 1 (cleared payment)`);
        changes.push(`nominal_amount: ${current.nominal_amount?.toString?.()} → ${current.account_currency_amount?.toString?.() ?? current.account_currency_amount} (cleared payment)`);
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

    if (correction_date !== undefined && correction_date !== current.correction_date) {
      updateData.correctionDate = correction_date ? new Date(correction_date) : null;
      changes.push(`correction_date: ${current.correction_date || 'null'} → ${correction_date || 'null'}`);
    }

    if (comment !== undefined && comment !== current.comment) {
      updateData.comment = comment ? String(comment) : null;
      changes.push(`comment: ${current.comment ?? 'null'} → ${comment ?? 'null'}`);
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
        correction_date ?? current.correction_date
      );
      
      if (result) {
        updateData.exchangeRate = result.exchangeRate;
        updateData.nominalAmount = result.nominalAmount;
        changes.push(`exchange_rate: ${current.exchange_rate?.toString()} → ${result.exchangeRate.toString()}`);
        changes.push(`nominal_amount: ${current.nominal_amount?.toString()} → ${result.nominalAmount.toString()} (recalculated)`);
      }
    }

    if (correction_date !== undefined) {
      const targetNominalCurrency = updateData.nominalCurrencyUuid || current.nominal_currency_uuid;
      if (targetNominalCurrency) {
        const result = await calculateExchangeRateAndAmount(
          current.account_currency_uuid,
          targetNominalCurrency,
          current.account_currency_amount,
          current.transaction_date,
          correction_date || null
        );

        if (result) {
          updateData.exchangeRate = result.exchangeRate;
          updateData.nominalAmount = result.nominalAmount;
          changes.push(`exchange_rate: ${current.exchange_rate?.toString()} → ${result.exchangeRate.toString()} (correction date)`);
          changes.push(`nominal_amount: ${current.nominal_amount?.toString()} → ${result.nominalAmount.toString()} (correction date)`);
        }
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

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;
    const uuidColumns = new Set([
      'counteragent_uuid',
      'project_uuid',
      'financial_code_uuid',
      'nominal_currency_uuid',
    ]);
    const numericColumns = new Set(['nominal_amount', 'exchange_rate']);

    const pushUpdate = (column: string, value: any) => {
      let cast = '';
      if (uuidColumns.has(column)) {
        cast = '::uuid';
      } else if (numericColumns.has(column)) {
        cast = '::numeric';
      }
      updateFields.push(`${column} = $${paramIndex++}${cast}`);
      updateValues.push(value);
    };

    if (updateData.counteragentUuid !== undefined) pushUpdate('counteragent_uuid', updateData.counteragentUuid);
    if (updateData.paymentId !== undefined) pushUpdate('payment_id', updateData.paymentId);
    if (updateData.projectUuid !== undefined) pushUpdate('project_uuid', updateData.projectUuid);
    if (updateData.financialCodeUuid !== undefined) pushUpdate('financial_code_uuid', updateData.financialCodeUuid);
    if (updateData.nominalCurrencyUuid !== undefined) pushUpdate('nominal_currency_uuid', updateData.nominalCurrencyUuid);
    if (updateData.nominalAmount !== undefined) pushUpdate('nominal_amount', updateData.nominalAmount?.toString?.() ?? updateData.nominalAmount);
    if (updateData.exchangeRate !== undefined) pushUpdate('exchange_rate', updateData.exchangeRate?.toString?.() ?? updateData.exchangeRate);
    if (updateData.parsingLock !== undefined) pushUpdate('parsing_lock', updateData.parsingLock);
    if (updateData.correctionDate !== undefined) pushUpdate('correction_date', updateData.correctionDate);
    if (updateData.comment !== undefined) pushUpdate('comment', updateData.comment);

    updateFields.push('updated_at = NOW()');
    updateValues.push(resolvedRecordId);

    const updateQuery = `
      UPDATE "${resolvedTableName}"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updatedRows = await prisma.$queryRawUnsafe<any[]>(updateQuery, ...updateValues);
    const updated = updatedRows[0];

    await logAudit({
      table: resolvedTableName,
      recordId: String(resolvedRecordId),
      action: "update",
      changes: {
        changes,
      },
    });

    console.log(`[PATCH /bank-transactions/${params.id}] ✓ Update successful`);
    console.log('[PATCH] Updated state:', {
      id: updated.id?.toString?.() ?? updated.id,
      counteragentUuid: updated.counteragent_uuid,
      projectUuid: updated.project_uuid,
      financialCodeUuid: updated.financial_code_uuid,
      nominalCurrencyUuid: updated.nominal_currency_uuid,
      nominalAmount: updated.nominal_amount?.toString?.() ?? updated.nominal_amount,
      paymentId: updated.payment_id,
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
