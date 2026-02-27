import { NextRequest, NextResponse } from 'next/server';
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

const buildPreviewRecord = (record: Record<string, unknown>) => {
  const normalized = normalizeRecord(record);
  const uuid = String(normalized.uuid ?? normalized.id ?? normalized.dockey ?? '');
  return {
    uuid,
    transaction_date:
      normalized.transaction_date ??
      normalized.docvaluedate ??
      normalized.docdate ??
      normalized.valuedate ??
      normalized.date ??
      null,
    debit:
      normalized.debit ??
      normalized.entrydbamt ??
      normalized.entrydbamount ??
      null,
    credit:
      normalized.credit ??
      normalized.entrycramt ??
      normalized.entrycramount ??
      null,
    description:
      normalized.description ??
      normalized.docinformation ??
      normalized.docnomination ??
      null,
    sender_name: normalized.sender_name ?? normalized.docsendername ?? null,
    beneficiary_name: normalized.beneficiary_name ?? normalized.docbenefname ?? null,
    sender_account:
      normalized.sender_account ?? normalized.docsenderacctno ?? null,
    beneficiary_account:
      normalized.beneficiary_account ?? normalized.docbenefacctno ?? null,
    processing_case:
      normalized.processing_case ?? normalized.processingcase ?? null
  };
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

const sanitizeJsonValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeJsonValue);
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, innerValue] of Object.entries(value)) {
      output[key] = sanitizeJsonValue(innerValue);
    }
    return output;
  }
  return value;
};

// Test a parsing rule against all transactions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ruleId, apply } = body;

    if (!ruleId) {
      return NextResponse.json(
        { error: 'ruleId is required' },
        { status: 400 }
      );
    }

    // Get the rule with its compiled script
    const rule = await prisma.$queryRawUnsafe<Array<{
      id: bigint;
      condition: string;
      condition_script: string | null;
            counteragent_uuid: string | null;
            financial_code_uuid: string | null;
            nominal_currency_uuid: string | null;
            payment_id: string | null;
            scheme_uuid: string;
    }>>(`
            SELECT id, condition, condition_script, counteragent_uuid, 
              financial_code_uuid, nominal_currency_uuid, payment_id,
              scheme_uuid
      FROM parsing_scheme_rules
      WHERE id = $1
    `, ruleId);

    if (!rule || rule.length === 0) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    const ruleData = rule[0];
    
    if (!ruleData.condition_script) {
      return NextResponse.json(
        { error: 'Rule has no compiled script - condition_script is null' },
        { status: 400 }
      );
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
      return NextResponse.json({
        success: true,
        matchCount: 0,
        records: [],
        message: 'No raw tables configured for this parsing scheme',
        applied: false,
        formula: ruleData.condition
      });
    }

    // Evaluate the condition_script against each record
    const matchingRecords: any[] = [];
    const matchedUuidsByTable = new Map<string, string[]>();
    
    console.log('Testing rule with compiled script:', ruleData.condition_script);
    
    const evalFunc = eval(ruleData.condition_script);
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
        const batch = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
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
            if (evalFunc(evalInput)) {
              const previewRecord = buildPreviewRecord(record);
              if (previewRecord.uuid) {
                matchingRecords.push(previewRecord);
                const existing = matchedUuidsByTable.get(raw_table_name) ?? [];
                existing.push(previewRecord.uuid);
                matchedUuidsByTable.set(raw_table_name, existing);
              }
            }
          } catch (evalError) {
            console.error(`Error evaluating rule ${ruleId} against record ${record.uuid}:`, evalError);
            // Continue processing other records even if one fails
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

    const matchCount = matchingRecords.length;

    if (matchCount === 0) {
      return NextResponse.json({
        success: true,
        matchCount: 0,
        records: [],
        message: 'No records match this rule',
        applied: false,
        formula: ruleData.condition
      });
    }

    // If not applying, return count and all matching records
    if (!apply) {
      const safeRecords = matchingRecords.map(sanitizeJsonValue);
      return NextResponse.json({
        success: true,
        matchCount,
        records: safeRecords,
        ruleId: Number(ruleData.id),
        formula: ruleData.condition,
        message: `Found ${matchCount} record(s) matching this rule`,
        applied: false
      });
    }

    // Apply the rule to all matching records
    for (const [rawTableName, uuids] of matchedUuidsByTable.entries()) {
      if (!uuids.length) continue;
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
      `, Number(ruleData.id), uuids);
    }

    // Now update deconsolidated table with the rule's parameters
    // Get the rule's counteragent, project, financial code, and currency
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
    
    const ruleParams = ruleWithParams[0];
    const hasRuleParams = !!(
      ruleParams?.counteragent_uuid ||
      ruleParams?.financial_code_uuid ||
      ruleParams?.nominal_currency_uuid ||
      ruleParams?.payment_id
    );

    if (ruleParams && hasRuleParams) {
      for (const [rawTableName, uuids] of matchedUuidsByTable.entries()) {
        if (!uuids.length) continue;
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
          ruleParams.counteragent_uuid,
          ruleParams.financial_code_uuid,
          ruleParams.nominal_currency_uuid,
          ruleParams.payment_id,
          uuids,
          Number(ruleData.id),
          `Applied rule manually, rule ID ${ruleData.id}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      matchCount,
      ruleId: Number(ruleData.id),
      formula: ruleData.condition,
      message: `Applied rule to ${matchCount} record(s) and updated deconsolidated table`,
      applied: true
    });

  } catch (error: any) {
    console.error('Error testing/applying rule:', error);
    return NextResponse.json(
      { error: 'Failed to test/apply rule', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/parsing-scheme-rules/test-rule',
    method: 'POST',
    description: 'Test or apply a parsing rule across all bank transactions',
    body: {
      ruleId: 'number (required) - The ID of the parsing rule to test/apply',
      apply: 'boolean (optional) - If true, applies the rule. If false/omitted, just counts matches'
    },
    example: {
      ruleId: 1,
      apply: false
    }
  });
}

