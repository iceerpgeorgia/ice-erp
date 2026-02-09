import {
  getSupabaseClient,
  loadCounteragents,
  loadParsingRules,
  loadPayments,
  loadNBGRates,
  loadCurrencyCache,
} from './db-utils';
import {
  calculateNominalAmount,
  computeCaseDescription,
  processSingleRecord,
} from './import_bank_xml_data_deconsolidated';
import type { ProcessingStats } from './types';

export const DECONSOLIDATED_TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
] as const;

const SELECT_COLUMNS =
  'id,uuid,dockey,docsenderinn,docbenefinn,doccoracct,docsenderacctno,docbenefacctno,docprodgroup,docnomination,docinformation,entrydbamt,entrycramt,account_currency_amount,account_currency_uuid,transaction_date,parsing_lock';

type ProcessingContext = {
  counteragentsMap: Map<string, any>;
  parsingRules: any[];
  paymentsMap: Map<string, any>;
  salaryBaseMap: Map<string, any>;
  salaryLatestMap: Map<string, any>;
  duplicatePaymentMap: Map<string, string>;
  nbgRatesMap: Map<string, any>;
  currencyCache: Map<string, string>;
};

const escapeLike = (value: string) => value.replace(/[%_]/g, '\\$&');

async function loadContext(): Promise<ProcessingContext> {
  const supabase = getSupabaseClient();
  const [counteragentsMap, parsingRules, paymentsBundle, nbgRatesMap, currencyCache] = await Promise.all([
    loadCounteragents(supabase),
    loadParsingRules(supabase),
    loadPayments(supabase),
    loadNBGRates(supabase),
    loadCurrencyCache(supabase),
  ]);

  const { paymentsMap, salaryBaseMap, salaryLatestMap, duplicatePaymentMap } = paymentsBundle;

  return {
    counteragentsMap,
    parsingRules,
    paymentsMap,
    salaryBaseMap,
    salaryLatestMap,
    duplicatePaymentMap,
    nbgRatesMap,
    currencyCache,
  };
}

async function reparseRows(
  tableName: string,
  rows: any[],
  context: ProcessingContext
): Promise<number> {
  if (!rows || rows.length === 0) return 0;

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
  const updateRows = rows.map((row: any, idx: number) => {
    const inputRow = {
      ...row,
      doccorracct: row.doccoracct ?? null,
      debit: row.entrydbamt ? Number(row.entrydbamt) : 0,
    };

    const result = processSingleRecord(
      inputRow,
      context.counteragentsMap,
      context.parsingRules,
      context.paymentsMap,
      context.salaryBaseMap,
      context.salaryLatestMap,
      context.duplicatePaymentMap,
      idx + 1,
      stats,
      missingCounteragents
    );

    const accountCurrencyUuid = row.account_currency_uuid;
    const accountCurrencyCode = accountCurrencyUuid ? context.currencyCache.get(accountCurrencyUuid) : null;
    const nominalCurrencyUuid = result.nominal_currency_uuid || accountCurrencyUuid || null;
    const transactionDate = row.transaction_date ? new Date(row.transaction_date) : null;

    const nominalAmount =
      transactionDate && accountCurrencyCode && nominalCurrencyUuid
        ? calculateNominalAmount(
            Number(row.account_currency_amount || 0),
            accountCurrencyCode,
            nominalCurrencyUuid,
            transactionDate,
            context.nbgRatesMap,
            context.currencyCache
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

  const supabase = getSupabaseClient();
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

  return updateRows.length;
}

export async function reparseBySourceId(
  tableName: string,
  sourceId: number
): Promise<number> {
  if (!DECONSOLIDATED_TABLES.includes(tableName as any)) {
    throw new Error('Unsupported source table');
  }

  const supabase = getSupabaseClient();
  const { data: rows, error } = await supabase
    .from(tableName)
    .select(SELECT_COLUMNS)
    .eq('id', sourceId);

  if (error) throw error;

  const context = await loadContext();
  return reparseRows(tableName, rows || [], context);
}

export async function reparseByPaymentId(paymentId: string): Promise<{ updated: number; byTable: Record<string, number> }> {
  const supabase = getSupabaseClient();
  const context = await loadContext();
  const escaped = escapeLike(paymentId.trim());

  const byTable: Record<string, number> = {};
  let total = 0;

  for (const tableName of DECONSOLIDATED_TABLES) {
    const { data: rows, error } = await supabase
      .from(tableName)
      .select(SELECT_COLUMNS)
      .ilike('payment_id', escaped);

    if (error) throw error;

    const updated = await reparseRows(tableName, rows || [], context);
    byTable[tableName] = updated;
    total += updated;
  }

  return { updated: total, byTable };
}
