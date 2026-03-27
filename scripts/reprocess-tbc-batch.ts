import 'dotenv/config';

import { Client } from 'pg';
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

const TARGET_TABLES = [
  'GE39TB7856036150100001_TBC_USD',
  'GE39TB7856036150100001_TBC_EUR',
  'GE79TB7856045067800004_TBC_GEL',
  'GE52TB7856045067800005_TBC_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

const BATCH_ID = process.argv[2] || 'xlsx-import-2026-03-18';

function quoteIdent(name: string): string {
  return '"' + String(name || '').replace(/"/g, '""') + '"';
}

async function main() {
  const connStr = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connStr) throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');

  const supabase = getSupabaseClient();
  console.log(`Reprocessing batch: ${BATCH_ID}`);
  console.log('Loading dictionaries from deconsolidated importer utils...');

  const [counteragentsMap, parsingRules, paymentsBundle, nbgRatesMap, currencyCache] = await Promise.all([
    loadCounteragents(supabase),
    loadParsingRules(supabase),
    loadPayments(supabase),
    loadNBGRates(supabase),
    loadCurrencyCache(supabase),
  ]);

  const { paymentsMap, salaryBaseMap, salaryLatestMap, duplicatePaymentMap } = paymentsBundle;

  const client = new Client({ connectionString: connStr });
  await client.connect();

  const overallStats: ProcessingStats = {
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

  let totalRows = 0;
  let totalUpdated = 0;

  try {
    for (const tableName of TARGET_TABLES) {
      const table = quoteIdent(tableName);

      const fetchSql = `
        SELECT
          id,
          uuid,
          dockey,
          docsenderinn,
          docbenefinn,
          doccoracct,
          docsenderacctno,
          docbenefacctno,
          docprodgroup,
          docnomination,
          docinformation,
          entrydbamt,
          entrycramt,
          account_currency_amount,
          account_currency_uuid,
          transaction_date,
          parsing_lock
        FROM ${table}
        WHERE import_batch_id = $1
      `;

      const result = await client.query(fetchSql, [BATCH_ID]);
      const rows = result.rows || [];
      totalRows += rows.length;

      if (rows.length === 0) {
        console.log(`${tableName}: no rows in batch`);
        continue;
      }

      let tableUpdated = 0;

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];

        if (row.parsing_lock === true) {
          continue;
        }

        const inputRow = {
          ...row,
          doccorracct: row.doccoracct ?? null,
          debit: row.entrydbamt ? Number(row.entrydbamt) : 0,
        };

        const proc = processSingleRecord(
          inputRow,
          counteragentsMap,
          parsingRules,
          paymentsMap,
          salaryBaseMap,
          salaryLatestMap,
          duplicatePaymentMap,
          i + 1,
          overallStats,
          missingCounteragents
        );

        const accountCurrencyUuid = row.account_currency_uuid ? String(row.account_currency_uuid) : null;
        const accountCurrencyCode = accountCurrencyUuid ? currencyCache.get(accountCurrencyUuid) : null;
        const nominalCurrencyUuid = proc.nominal_currency_uuid || accountCurrencyUuid;

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
          proc.case1_counteragent_processed,
          false,
          proc.case3_counteragent_missing,
          proc.case4_payment_id_matched,
          proc.case5_payment_id_conflict,
          proc.case6_parsing_rule_applied,
          proc.case7_parsing_rule_conflict,
          false,
          proc.applied_rule_id
        );

        const updateSql = `
          UPDATE ${table}
          SET
            counteragent_processed = $1,
            parsing_rule_processed = $2,
            payment_id_processed = $3,
            is_processed = $4,
            counteragent_inn = $5,
            applied_rule_id = $6,
            processing_case = $7,
            counteragent_uuid = $8,
            counteragent_account_number = $9,
            project_uuid = $10,
            financial_code_uuid = $11,
            payment_id = $12,
            nominal_currency_uuid = $13,
            nominal_amount = $14,
            updated_at = NOW()
          WHERE uuid = $15 AND import_batch_id = $16
        `;

        await client.query(updateSql, [
          proc.case1_counteragent_processed,
          proc.case6_parsing_rule_applied,
          proc.case4_payment_id_matched,
          Boolean(proc.case1_counteragent_processed && proc.case6_parsing_rule_applied && proc.case4_payment_id_matched),
          proc.counteragent_inn,
          proc.applied_rule_id,
          caseDescription,
          proc.counteragent_uuid,
          proc.counteragent_account_number,
          proc.project_uuid,
          proc.financial_code_uuid,
          proc.payment_id,
          nominalCurrencyUuid,
          nominalAmount,
          row.uuid,
          BATCH_ID,
        ]);
        tableUpdated += 1;
      }

      totalUpdated += tableUpdated;
      console.log(`${tableName}: batch rows=${rows.length}, updated=${tableUpdated}`);
    }
  } finally {
    await client.end();
  }

  console.log('');
  console.log('Reprocess summary:');
  console.log(`  total batch rows scanned: ${totalRows}`);
  console.log(`  total rows updated: ${totalUpdated}`);
  console.log(`  case1 counteragent processed: ${overallStats.case1_counteragent_processed}`);
  console.log(`  case3 INN non-match: ${overallStats.case3_counteragent_inn_nonblank_no_match}`);
  console.log(`  case6 parsing rule match: ${overallStats.case6_parsing_rule_match}`);
  console.log(`  case4 payment match: ${overallStats.case4_payment_id_match}`);
  console.log(`  case5 payment conflict: ${overallStats.case5_payment_id_counteragent_mismatch}`);
  console.log(`  case7 rule conflict: ${overallStats.case7_parsing_rule_counteragent_mismatch}`);
  console.log(`  missing counteragent INN keys: ${missingCounteragents.size}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
