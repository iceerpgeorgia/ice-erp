import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import {
  getSupabaseClient,
  loadCounteragents,
  loadParsingRules,
  loadPayments,
  loadNBGRates,
  loadCurrencyCache,
} from '../lib/bank-import/db-utils';
import {
  calculateNominalAmount,
  computeCaseDescription,
  processSingleRecord,
} from '../lib/bank-import/import_bank_xml_data_deconsolidated';
import type { ProcessingStats } from '../lib/bank-import/types';

const tableName = process.argv[2];
const shouldClear = !process.argv.includes('--no-clear');
const batchSize = Number(process.env.BATCH_SIZE ?? '500');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

if (!tableName) {
  console.error('Usage: ts-node scripts/reparse-deconsolidated-table.ts <table_name> [--no-clear]');
  process.exit(1);
}

async function fetchBatch(supabase: ReturnType<typeof getSupabaseClient>, from: number, to: number) {
  return supabase
    .from(tableName)
    .select(
      'id,uuid,dockey,docsenderinn,docbenefinn,doccoracct,docsenderacctno,docbenefacctno,docprodgroup,docnomination,docinformation,entrydbamt,entrycramt,account_currency_amount,account_currency_uuid,transaction_date,parsing_lock'
    )
    .or('parsing_lock.is.null,parsing_lock.eq.false')
    .order('id', { ascending: true })
    .range(from, to);
}

async function main() {
  loadEnv();
  console.log(`🔁 Reparse deconsolidated table: ${tableName}`);
  const supabase = getSupabaseClient();

  if (shouldClear) {
    console.log('🧹 Clearing parsing columns...');
    const { error: clearError } = await supabase
      .from(tableName)
      .update({
        counteragent_uuid: null,
        counteragent_account_number: null,
        counteragent_inn: null,
        project_uuid: null,
        financial_code_uuid: null,
        payment_id: null,
        applied_rule_id: null,
        processing_case: null,
        counteragent_processed: false,
        parsing_rule_processed: false,
        payment_id_processed: false,
        is_processed: false,
      })
      .or('parsing_lock.is.null,parsing_lock.eq.false');

    if (clearError) {
      throw clearError;
    }
  }

  console.log('📚 Loading dictionaries...');
  const [counteragentsMap, parsingRules, paymentsBundle, nbgRatesMap, currencyCache] = await Promise.all([
    loadCounteragents(supabase),
    loadParsingRules(supabase),
    loadPayments(supabase),
    loadNBGRates(supabase),
    loadCurrencyCache(supabase),
  ]);

  const { paymentsMap, salaryBaseMap, salaryLatestMap } = paymentsBundle;

  const stats: ProcessingStats = {
    case1_counteragent_processed: 0,
    case2_counteragent_inn_blank: 0,
    case3_counteragent_inn_nonblank_no_match: 0,
    case4_payment_id_match: 0,
    case5_payment_id_counteragent_mismatch: 0,
    case6_parsing_rule_match: 0,
    case7_parsing_rule_counteragent_mismatch: 0,
    case8_parsing_rule_dominance: 0,
  };

  const missingCounteragents = new Map<string, { inn: string; count: number; name: string }>();

  let offset = 0;
  let totalProcessed = 0;
  const startTime = Date.now();

  while (true) {
    const { data, error } = await fetchBatch(supabase, offset, offset + batchSize - 1);
    if (error) {
      throw error;
    }

    if (!data || data.length === 0) break;

    const updateRows = data.map((row: any, idx: number) => {
      const inputRow = {
        ...row,
        doccorracct: row.doccoracct ?? null,
        debit: row.entrydbamt ? Number(row.entrydbamt) : 0,
      };

      const result = processSingleRecord(
        inputRow,
        counteragentsMap,
        parsingRules,
        paymentsMap,
        salaryBaseMap,
        salaryLatestMap,
        totalProcessed + idx + 1,
        stats,
        missingCounteragents
      );

      const accountCurrencyUuid = row.account_currency_uuid;
      const accountCurrencyCode = accountCurrencyUuid ? currencyCache.get(accountCurrencyUuid) : null;
      const nominalCurrencyUuid = result.nominal_currency_uuid || accountCurrencyUuid || null;
      const transactionDate = row.transaction_date ? new Date(row.transaction_date) : null;

      const nominalAmount =
        transactionDate && accountCurrencyCode && nominalCurrencyUuid
          ? calculateNominalAmount(
              Number(row.account_currency_amount || 0),
              accountCurrencyCode,
              nominalCurrencyUuid,
              transactionDate,
              nbgRatesMap,
              currencyCache
            )
          : Number(row.account_currency_amount || 0);

      const caseDescription = computeCaseDescription(
        result.case1_counteragent_processed,
        false,
        result.case3_counteragent_missing,
        result.case4_payment_id_matched,
        result.case5_payment_id_conflict,
        result.case6_parsing_rule_applied,
        result.case7_parsing_rule_conflict,
        false,
        result.applied_rule_id
      );

      return {
        id: row.id,
        uuid: row.uuid,
        counteragent_processed: result.case1_counteragent_processed,
        parsing_rule_processed: result.case6_parsing_rule_applied,
        payment_id_processed: result.case4_payment_id_matched,
        is_processed: Boolean(
          result.case1_counteragent_processed && result.case6_parsing_rule_applied && result.case4_payment_id_matched
        ),
        counteragent_inn: result.counteragent_inn,
        applied_rule_id: result.applied_rule_id,
        processing_case: caseDescription,
        counteragent_uuid: result.counteragent_uuid,
        counteragent_account_number: result.counteragent_account_number,
        project_uuid: result.project_uuid,
        financial_code_uuid: result.financial_code_uuid,
        payment_id: result.payment_id,
        nominal_currency_uuid: nominalCurrencyUuid,
        nominal_amount: nominalAmount,
      };
    });

    if (updateRows.length > 0) {
      const columns = [
        'id',
        'counteragent_processed',
        'parsing_rule_processed',
        'payment_id_processed',
        'is_processed',
        'counteragent_inn',
        'applied_rule_id',
        'processing_case',
        'counteragent_uuid',
        'counteragent_account_number',
        'project_uuid',
        'financial_code_uuid',
        'payment_id',
        'nominal_currency_uuid',
        'nominal_amount',
      ];

      const values: any[] = [];
      const rowsSql = updateRows
        .map((row, rowIndex) => {
          const baseIndex = rowIndex * columns.length;
          values.push(
            row.id,
            row.counteragent_processed,
            row.parsing_rule_processed,
            row.payment_id_processed,
            row.is_processed,
            row.counteragent_inn,
            row.applied_rule_id,
            row.processing_case,
            row.counteragent_uuid,
            row.counteragent_account_number,
            row.project_uuid,
            row.financial_code_uuid,
            row.payment_id,
            row.nominal_currency_uuid,
            row.nominal_amount
          );

          const placeholders = columns
            .map((_, colIndex) => `$${baseIndex + colIndex + 1}`)
            .join(', ');
          return `(${placeholders})`;
        })
        .join(', ');

      const updateSql = `
        UPDATE "${tableName}" AS t
        SET
          updated_at = NOW(),
          counteragent_processed = v.counteragent_processed,
          parsing_rule_processed = v.parsing_rule_processed,
          payment_id_processed = v.payment_id_processed,
          is_processed = v.is_processed,
          counteragent_inn = v.counteragent_inn,
          applied_rule_id = v.applied_rule_id,
          processing_case = v.processing_case,
          counteragent_uuid = NULLIF(v.counteragent_uuid, '')::uuid,
          counteragent_account_number = v.counteragent_account_number,
          project_uuid = NULLIF(v.project_uuid, '')::uuid,
          financial_code_uuid = NULLIF(v.financial_code_uuid, '')::uuid,
          payment_id = v.payment_id,
          nominal_currency_uuid = NULLIF(v.nominal_currency_uuid, '')::uuid,
          nominal_amount = v.nominal_amount
        FROM (VALUES ${rowsSql}) AS v(${columns.join(', ')})
        WHERE t.id = v.id AND COALESCE(t.parsing_lock, false) = false
      `;

      await prisma.$executeRawUnsafe(updateSql, ...values);
    }

    totalProcessed += data.length;
    offset += batchSize;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Updated ${totalProcessed} records (${elapsed}s)`);
  }

  console.log('\n📊 Reparse summary');
  console.log(`  ✅ Counteragent matched: ${stats.case1_counteragent_processed}`);
  console.log(`  ⚠️  INN missing: ${stats.case2_counteragent_inn_blank}`);
  console.log(`  ⚠️  INN no match: ${stats.case3_counteragent_inn_nonblank_no_match}`);
  console.log(`  ✅ Rules applied: ${stats.case6_parsing_rule_match}`);
  console.log(`  ⚠️  Rule conflicts: ${stats.case7_parsing_rule_counteragent_mismatch}`);
  console.log(`  ✅ Payment matched: ${stats.case4_payment_id_match}`);
  console.log(`  ⚠️  Payment conflicts: ${stats.case5_payment_id_counteragent_mismatch}`);

  if (missingCounteragents.size > 0) {
    console.log(`\n⚠️  Missing counteragents: ${missingCounteragents.size}`);
  }
}

main().catch((error) => {
  console.error('❌ Reparse failed:', error);
  process.exit(1);
});
