import { config } from 'dotenv';

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

config();

const DEFAULT_TABLE = 'GE78BG0000000893486000_BOG_GEL';

async function main() {
  const tableName = process.argv[2] || DEFAULT_TABLE;
  const batchSize = Number(process.argv[3] || 1000);

  const supabase = getSupabaseClient();

  console.log(`🔄 Backparsing deconsolidated table: ${tableName}`);
  console.log(`📦 Batch size: ${batchSize}`);
  console.log('🔒 Skipping rows with parsing_lock = true\n');

  const [counteragentsMap, parsingRules, paymentsBundle, nbgRatesMap, currencyCache] = await Promise.all([
    loadCounteragents(supabase),
    loadParsingRules(supabase),
    loadPayments(supabase),
    loadNBGRates(supabase),
    loadCurrencyCache(supabase),
  ]);

  const { paymentsMap, salaryBaseMap, salaryLatestMap, duplicatePaymentMap } = paymentsBundle;

  let offset = 0;
  let totalUpdated = 0;

  while (true) {
    const { data: rows, error: fetchError } = await supabase
      .from(tableName)
      .select(
        'id,uuid,dockey,docsenderinn,docbenefinn,doccoracct,docsenderacctno,docbenefacctno,docprodgroup,docnomination,docinformation,entrydbamt,entrycramt,account_currency_amount,account_currency_uuid,transaction_date,parsing_lock'
      )
      .or('parsing_lock.is.null,parsing_lock.eq.false')
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      throw fetchError;
    }

    if (!rows || rows.length === 0) {
      break;
    }

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

    const updateRows = rows.map((row: any, idx: number) => {
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
        duplicatePaymentMap,
        idx + 1,
        stats,
        new Map()
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
        uuid: row.uuid,
        id: row.id,
        counteragent_processed: result.case1_counteragent_processed,
        parsing_rule_processed: result.case6_parsing_rule_applied,
        payment_id_processed: result.case4_payment_id_matched,
        is_processed: Boolean(
          result.case1_counteragent_processed &&
            result.case6_parsing_rule_applied &&
            result.case4_payment_id_matched
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

    const updateChunkSize = 20;
    for (let i = 0; i < updateRows.length; i += updateChunkSize) {
      const chunk = updateRows.slice(i, i + updateChunkSize);
      const results = await Promise.all(
        chunk.map((updateRow) =>
          supabase
            .from(tableName)
            .update(updateRow)
            .eq('id', updateRow.id)
        )
      );

      for (const result of results) {
        if (result.error) {
          throw result.error;
        }
      }
    }

    totalUpdated += updateRows.length;
    offset += batchSize;
    console.log(`✅ Updated ${totalUpdated} rows...`);
  }

  console.log(`\n✅ Backparse completed. Updated ${totalUpdated} rows in ${tableName}.`);
}

main().catch((err) => {
  console.error('❌ Backparse failed:', err);
  process.exit(1);
});
