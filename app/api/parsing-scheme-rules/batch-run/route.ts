import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const RAW_TABLE_NAME_RE = /^[A-Za-z0-9_]+$/;
const RAW_SCAN_BATCH = 5000;

const normalizeRecord = (record: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key] = value;
    const lowerKey = key.toLowerCase();
    if (!(lowerKey in normalized)) {
      normalized[lowerKey] = value;
    }
  }
  return normalized;
};

const buildDeconsolidatedTableName = (
  accountNumber: string | null,
  schemeName: string | null,
  currencyCode: string | null
) => {
  if (!accountNumber || !schemeName) {
    return null;
  }
  if (schemeName.endsWith('_FX')) {
    if (!currencyCode) {
      return null;
    }
    const prefix = schemeName.replace(/_FX$/, '');
    return `${accountNumber}_${prefix}_${currencyCode}`;
  }
  return `${accountNumber}_${schemeName}`;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ruleIds } = await request.json();

    if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
      return NextResponse.json(
        { error: 'Rule IDs array is required' },
        { status: 400 }
      );
    }

    console.log(`Processing ${ruleIds.length} rules...`);

    const results: Array<{
      ruleId: number;
      matchedRecords: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const ruleId of ruleIds) {
      try {
        // Fetch rule details
        type RuleData = {
          id: bigint;
          condition: string;
          condition_script: string | null;
          counteragent_uuid: string | null;
          financial_code_uuid: string | null;
          nominal_currency_uuid: string | null;
          payment_id: string | null;
          scheme_uuid: string;
        };

        const rules = await prisma.$queryRawUnsafe<RuleData[]>(`
             SELECT id, condition, condition_script, counteragent_uuid,
               financial_code_uuid, nominal_currency_uuid, payment_id,
               scheme_uuid
          FROM parsing_scheme_rules
          WHERE id = $1
        `, Number(ruleId));

        if (rules.length === 0) {
          results.push({
            ruleId,
            matchedRecords: 0,
            success: false,
            error: 'Rule not found'
          });
          continue;
        }

        const ruleData = rules[0];

        if (!ruleData.condition_script) {
          results.push({
            ruleId,
            matchedRecords: 0,
            success: false,
            error: 'Rule has no compiled script'
          });
          continue;
        }

        const rawTables = await prisma.$queryRawUnsafe<Array<{
          raw_table_name: string;
          account_number: string | null;
          parsing_scheme_name: string | null;
          currency_code: string | null;
        }>>(`
          SELECT
            ba.raw_table_name,
            ba.account_number,
            ps.scheme as parsing_scheme_name,
            c.code as currency_code
          FROM bank_accounts ba
          LEFT JOIN parsing_schemes ps ON ba.parsing_scheme_uuid = ps.uuid
          LEFT JOIN currencies c ON ba.currency_uuid = c.uuid
          WHERE ba.parsing_scheme_uuid = $1::uuid
            AND ba.raw_table_name IS NOT NULL
        `, ruleData.scheme_uuid);

        if (!rawTables.length) {
          results.push({
            ruleId,
            matchedRecords: 0,
            success: true
          });
          continue;
        }

        // Evaluate the condition script
        const evalFunction = eval(ruleData.condition_script);
        const matchingRecords: { uuid: string; rawTableName: string }[] = [];
        const matchedUuidsByTable = new Map<string, string[]>();

        const rawTableToDeconsolidated = new Map<string, string>();
        for (const row of rawTables) {
          const deconsolidatedTable = buildDeconsolidatedTableName(
            row.account_number,
            row.parsing_scheme_name,
            row.currency_code
          );
          if (deconsolidatedTable) {
            rawTableToDeconsolidated.set(row.raw_table_name, deconsolidatedTable);
          }
        }

        for (const { raw_table_name } of rawTables) {
          if (!RAW_TABLE_NAME_RE.test(raw_table_name)) {
            console.error(`Skipping invalid raw table name: ${raw_table_name}`);
            continue;
          }

          const tableRef = `"${raw_table_name}"`;
          let lastId = 0;
          while (true) {
            const batch = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
              `SELECT * FROM ${tableRef} WHERE id > $1 ORDER BY id ASC LIMIT $2`,
              lastId,
              RAW_SCAN_BATCH
            );

            if (batch.length === 0) {
              break;
            }

            for (const record of batch) {
              try {
                const evalInput = normalizeRecord(record);
                if (evalFunction(evalInput)) {
                  const uuid = String(record.uuid || record.UUID || record.id || '');
                  if (uuid) {
                    matchingRecords.push({ uuid, rawTableName: raw_table_name });
                    const existing = matchedUuidsByTable.get(raw_table_name) ?? [];
                    existing.push(uuid);
                    matchedUuidsByTable.set(raw_table_name, existing);
                  }
                }
              } catch (err) {
                console.error('Error evaluating record:', err);
              }
            }

            const lastRecord = batch[batch.length - 1];
            const nextId = Number((lastRecord as { id?: unknown }).id);
            if (!Number.isFinite(nextId)) {
              break;
            }
            lastId = nextId;
          }
        }

        console.log(`Rule ${ruleId}: Found ${matchingRecords.length} matching records`);

        if (matchingRecords.length === 0) {
          results.push({
            ruleId,
            matchedRecords: 0,
            success: true
          });
          continue;
        }

        // Apply the rule
        const uuids = matchingRecords.map(r => r.uuid);

        for (const [rawTableName, tableUuids] of matchedUuidsByTable.entries()) {
          if (!tableUuids.length) continue;
          if (!RAW_TABLE_NAME_RE.test(rawTableName)) {
            console.error(`Skipping invalid raw table name for update: ${rawTableName}`);
            continue;
          }
          await prisma.$queryRawUnsafe(`
            UPDATE "${rawTableName}"
            SET 
              parsing_rule_applied = TRUE,
              parsing_rule_processed = TRUE,
              applied_rule_id = $1,
              updated_at = NOW()
            WHERE uuid = ANY($2::uuid[])
          `, Number(ruleData.id), tableUuids);
        }

        // Fetch rule parameters
        const ruleWithParams = await prisma.$queryRawUnsafe<Array<{
          counteragent_uuid: string | null;
          financial_code_uuid: string | null;
          nominal_currency_uuid: string | null;
          payment_id: string | null;
        }>>(`
          SELECT counteragent_uuid, financial_code_uuid, nominal_currency_uuid, payment_id
          FROM parsing_scheme_rules
          WHERE id = $1
        `, Number(ruleData.id));

        // Update deconsolidated table
        const ruleParams = ruleWithParams[0];

        let paymentParams: {
          counteragent_uuid: string | null;
          financial_code_uuid: string | null;
          currency_uuid: string | null;
        } | null = null;

        if (ruleParams?.payment_id) {
          const paymentRows = await prisma.$queryRawUnsafe<Array<{
            counteragent_uuid: string | null;
            financial_code_uuid: string | null;
            currency_uuid: string | null;
          }>>(
            `
              SELECT counteragent_uuid, financial_code_uuid, currency_uuid
              FROM payments
              WHERE payment_id = $1
              LIMIT 1
            `,
            ruleParams.payment_id
          );
          paymentParams = paymentRows[0] ?? null;
        }

        const effectiveCounteragentUuid =
          ruleParams?.counteragent_uuid ?? paymentParams?.counteragent_uuid ?? null;
        const effectiveFinancialCodeUuid =
          ruleParams?.financial_code_uuid ?? paymentParams?.financial_code_uuid ?? null;
        const effectiveNominalCurrencyUuid =
          ruleParams?.nominal_currency_uuid ?? paymentParams?.currency_uuid ?? null;
        const effectivePaymentId = ruleParams?.payment_id ?? null;

        const hasRuleParams = !!(
          effectiveCounteragentUuid ||
          effectiveFinancialCodeUuid ||
          effectiveNominalCurrencyUuid ||
          effectivePaymentId
        );

        if (ruleParams && hasRuleParams) {
          for (const [rawTableName, tableUuids] of matchedUuidsByTable.entries()) {
            if (!tableUuids.length) continue;
            const deconsolidatedTable = rawTableToDeconsolidated.get(rawTableName);
            if (!deconsolidatedTable || !RAW_TABLE_NAME_RE.test(deconsolidatedTable)) {
              console.error(`Skipping invalid deconsolidated table: ${deconsolidatedTable}`);
              continue;
            }
            await prisma.$queryRawUnsafe(`
              WITH target_rows AS (
                SELECT
                  d.raw_record_uuid,
                  d.account_currency_amount,
                  d.account_currency_uuid,
                  COALESCE($3::uuid, d.nominal_currency_uuid) as next_nominal_currency_uuid,
                  d.transaction_date::date as tx_date,
                  acc.code as account_code,
                  nom.code as nominal_code,
                  rates.usd_rate,
                  rates.eur_rate,
                  rates.cny_rate,
                  rates.gbp_rate,
                  rates.rub_rate,
                  rates.try_rate,
                  rates.aed_rate,
                  rates.kzt_rate
                FROM "${deconsolidatedTable}" d
                LEFT JOIN currencies acc ON acc.uuid = d.account_currency_uuid
                LEFT JOIN currencies nom ON nom.uuid = COALESCE($3::uuid, d.nominal_currency_uuid)
                LEFT JOIN nbg_exchange_rates rates ON rates.date = d.transaction_date::date
                WHERE d.raw_record_uuid = ANY($5::uuid[])
              )
              UPDATE "${deconsolidatedTable}" d
              SET
                counteragent_uuid = COALESCE($1::uuid, d.counteragent_uuid),
                financial_code_uuid = COALESCE($2::uuid, d.financial_code_uuid),
                nominal_currency_uuid = t.next_nominal_currency_uuid,
                nominal_amount = CASE
                  WHEN t.account_currency_amount IS NULL THEN d.nominal_amount
                  WHEN t.account_code IS NULL OR t.nominal_code IS NULL THEN t.account_currency_amount
                  WHEN t.account_code = t.nominal_code THEN t.account_currency_amount
                  WHEN t.account_code = 'GEL' THEN
                    CASE t.nominal_code
                      WHEN 'USD' THEN CASE WHEN t.usd_rate IS NOT NULL AND t.usd_rate <> 0 THEN t.account_currency_amount / t.usd_rate ELSE t.account_currency_amount END
                      WHEN 'EUR' THEN CASE WHEN t.eur_rate IS NOT NULL AND t.eur_rate <> 0 THEN t.account_currency_amount / t.eur_rate ELSE t.account_currency_amount END
                      WHEN 'CNY' THEN CASE WHEN t.cny_rate IS NOT NULL AND t.cny_rate <> 0 THEN t.account_currency_amount / t.cny_rate ELSE t.account_currency_amount END
                      WHEN 'GBP' THEN CASE WHEN t.gbp_rate IS NOT NULL AND t.gbp_rate <> 0 THEN t.account_currency_amount / t.gbp_rate ELSE t.account_currency_amount END
                      WHEN 'RUB' THEN CASE WHEN t.rub_rate IS NOT NULL AND t.rub_rate <> 0 THEN t.account_currency_amount / t.rub_rate ELSE t.account_currency_amount END
                      WHEN 'TRY' THEN CASE WHEN t.try_rate IS NOT NULL AND t.try_rate <> 0 THEN t.account_currency_amount / t.try_rate ELSE t.account_currency_amount END
                      WHEN 'AED' THEN CASE WHEN t.aed_rate IS NOT NULL AND t.aed_rate <> 0 THEN t.account_currency_amount / t.aed_rate ELSE t.account_currency_amount END
                      WHEN 'KZT' THEN CASE WHEN t.kzt_rate IS NOT NULL AND t.kzt_rate <> 0 THEN t.account_currency_amount / t.kzt_rate ELSE t.account_currency_amount END
                      ELSE t.account_currency_amount
                    END
                  WHEN t.nominal_code = 'GEL' THEN
                    CASE t.account_code
                      WHEN 'USD' THEN CASE WHEN t.usd_rate IS NOT NULL THEN t.account_currency_amount * t.usd_rate ELSE t.account_currency_amount END
                      WHEN 'EUR' THEN CASE WHEN t.eur_rate IS NOT NULL THEN t.account_currency_amount * t.eur_rate ELSE t.account_currency_amount END
                      WHEN 'CNY' THEN CASE WHEN t.cny_rate IS NOT NULL THEN t.account_currency_amount * t.cny_rate ELSE t.account_currency_amount END
                      WHEN 'GBP' THEN CASE WHEN t.gbp_rate IS NOT NULL THEN t.account_currency_amount * t.gbp_rate ELSE t.account_currency_amount END
                      WHEN 'RUB' THEN CASE WHEN t.rub_rate IS NOT NULL THEN t.account_currency_amount * t.rub_rate ELSE t.account_currency_amount END
                      WHEN 'TRY' THEN CASE WHEN t.try_rate IS NOT NULL THEN t.account_currency_amount * t.try_rate ELSE t.account_currency_amount END
                      WHEN 'AED' THEN CASE WHEN t.aed_rate IS NOT NULL THEN t.account_currency_amount * t.aed_rate ELSE t.account_currency_amount END
                      WHEN 'KZT' THEN CASE WHEN t.kzt_rate IS NOT NULL THEN t.account_currency_amount * t.kzt_rate ELSE t.account_currency_amount END
                      ELSE t.account_currency_amount
                    END
                  ELSE
                    (
                      t.account_currency_amount *
                      CASE t.account_code
                        WHEN 'USD' THEN COALESCE(t.usd_rate, 0)
                        WHEN 'EUR' THEN COALESCE(t.eur_rate, 0)
                        WHEN 'CNY' THEN COALESCE(t.cny_rate, 0)
                        WHEN 'GBP' THEN COALESCE(t.gbp_rate, 0)
                        WHEN 'RUB' THEN COALESCE(t.rub_rate, 0)
                        WHEN 'TRY' THEN COALESCE(t.try_rate, 0)
                        WHEN 'AED' THEN COALESCE(t.aed_rate, 0)
                        WHEN 'KZT' THEN COALESCE(t.kzt_rate, 0)
                        ELSE 0
                      END
                    ) /
                    NULLIF(
                      CASE t.nominal_code
                        WHEN 'USD' THEN COALESCE(t.usd_rate, 0)
                        WHEN 'EUR' THEN COALESCE(t.eur_rate, 0)
                        WHEN 'CNY' THEN COALESCE(t.cny_rate, 0)
                        WHEN 'GBP' THEN COALESCE(t.gbp_rate, 0)
                        WHEN 'RUB' THEN COALESCE(t.rub_rate, 0)
                        WHEN 'TRY' THEN COALESCE(t.try_rate, 0)
                        WHEN 'AED' THEN COALESCE(t.aed_rate, 0)
                        WHEN 'KZT' THEN COALESCE(t.kzt_rate, 0)
                        ELSE 0
                      END,
                      0
                    )
                END,
                payment_id = COALESCE($4::text, d.payment_id),
                applied_rule_id = $6::bigint,
                processing_case = $7,
                updated_at = NOW()
              FROM target_rows t
              WHERE d.raw_record_uuid = t.raw_record_uuid
            `,
              effectiveCounteragentUuid,
              effectiveFinancialCodeUuid,
              effectiveNominalCurrencyUuid,
              effectivePaymentId,
              tableUuids,
              Number(ruleData.id),
              `Applied rule manually, rule ID ${ruleData.id}`
            );
          }
        }

        results.push({
          ruleId,
          matchedRecords: matchingRecords.length,
          success: true
        });

      } catch (error: any) {
        console.error(`Error processing rule ${ruleId}:`, error);
        results.push({
          ruleId,
          matchedRecords: 0,
          success: false,
          error: error.message
        });
      }
    }

    const totalMatched = results.reduce((sum, r) => sum + r.matchedRecords, 0);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Processed ${successCount} of ${ruleIds.length} rules. Applied to ${totalMatched} record(s).`,
      results
    });

  } catch (error: any) {
    console.error('Error in batch rule processing:', error);
    return NextResponse.json(
      { error: 'Failed to process rules', details: error.message },
      { status: 500 }
    );
  }
}

