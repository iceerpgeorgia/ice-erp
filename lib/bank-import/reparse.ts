import {
  getSupabaseClient,
  loadCounteragents,
  loadParsingRules,
  loadPayments,
  loadNBGRates,
  loadCurrencyCache,
} from './db-utils';
import { prisma } from '@/lib/prisma';
import {
  calculateNominalAmount,
  computeCaseDescription,
  processSingleRecord,
} from './import_bank_xml_data_deconsolidated';
import type { ProcessingStats } from './types';

const FALLBACK_DECONSOLIDATED_TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
] as const;

type TableNameRow = { table_name: string };

async function getDeconsolidatedTables(): Promise<string[]> {
  try {
    const rows = (await prisma.$queryRawUnsafe(`
      SELECT t.table_name
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND (
          t.table_name LIKE '%\\_BOG\\_%' ESCAPE '\\'
          OR t.table_name LIKE '%\\_TBC\\_%' ESCAPE '\\'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = t.table_schema
            AND c.table_name = t.table_name
            AND c.column_name = 'counteragent_inn'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = t.table_schema
            AND c.table_name = t.table_name
            AND c.column_name = 'counteragent_processed'
        )
      ORDER BY t.table_name
    `)) as TableNameRow[];

    const discovered = rows
      .map((row) => String(row.table_name || '').trim())
      .filter((name) => name.length > 0);

    return discovered.length > 0 ? discovered : [...FALLBACK_DECONSOLIDATED_TABLES];
  } catch {
    return [...FALLBACK_DECONSOLIDATED_TABLES];
  }
}

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

  // Mirror the same updates to local DB so reads via prisma are consistent
  if (updateRows.length > 0) {
    const COLUMNS = [
      'counteragent_processed', 'parsing_rule_processed', 'payment_id_processed',
      'is_processed', 'counteragent_inn', 'applied_rule_id', 'processing_case',
      'counteragent_uuid', 'counteragent_account_number', 'project_uuid',
      'financial_code_uuid', 'payment_id', 'nominal_currency_uuid', 'nominal_amount',
    ];
    const setClause = COLUMNS.map((col) => `"${col}" = d."${col}"`).join(', ');
    // Build VALUES rows: (id, col1, col2, ...)
    const params: any[] = [];
    const valueRows: string[] = [];
    let pi = 1;
    for (const row of updateRows) {
      const placeholders = [
        `$${pi}::bigint`,
        `$${pi + 1}::boolean`, `$${pi + 2}::boolean`, `$${pi + 3}::boolean`,
        `$${pi + 4}::boolean`, `$${pi + 5}::text`, `$${pi + 6}::text`, `$${pi + 7}::text`,
        `$${pi + 8}::uuid`, `$${pi + 9}::text`, `$${pi + 10}::uuid`,
        `$${pi + 11}::uuid`, `$${pi + 12}::text`, `$${pi + 13}::uuid`, `$${pi + 14}::numeric`,
      ];
      valueRows.push(`(${placeholders.join(',')})`);
      params.push(
        row.id,
        row.counteragent_processed, row.parsing_rule_processed, row.payment_id_processed,
        row.is_processed, row.counteragent_inn, row.applied_rule_id, row.processing_case,
        row.counteragent_uuid || null, row.counteragent_account_number || null, row.project_uuid || null,
        row.financial_code_uuid || null, row.payment_id || null, row.nominal_currency_uuid || null, row.nominal_amount,
      );
      pi += 15;
    }
    const localSql = `
      UPDATE "${tableName}" AS t SET ${setClause}, updated_at = NOW()
      FROM (VALUES ${valueRows.join(',')})
        AS d(id, ${COLUMNS.map((c) => `"${c}"`).join(', ')})
      WHERE t.id = d.id
    `;
    try {
      await prisma.$queryRawUnsafe(localSql, ...params);
    } catch (localErr) {
      console.warn(`[reparse] Local DB mirror update failed for ${tableName}:`, localErr);
    }
  }

  return updateRows.length;
}

export async function reparseBySourceId(
  tableName: string,
  sourceId: number
): Promise<number> {
  const supportedTables = await getDeconsolidatedTables();
  if (!supportedTables.includes(tableName)) {
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
  const tables = await getDeconsolidatedTables();

  const byTable: Record<string, number> = {};
  let total = 0;

  for (const tableName of tables) {
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

export async function reparseByCounteragentInn(
  inns: string[]
): Promise<{ updated: number; byTable: Record<string, number> }> {
  const normalizedInns = Array.from(
    new Set(
      inns
        .map((value) => String(value || '').replace(/\D/g, ''))
        .filter((value) => value.length > 0)
        .flatMap((value) => (value.length === 10 ? [value, `0${value}`] : [value]))
    )
  );

  if (normalizedInns.length === 0) {
    return { updated: 0, byTable: {} };
  }

  const supabase = getSupabaseClient();
  const context = await loadContext();
  const tables = await getDeconsolidatedTables();

  const byTable: Record<string, number> = {};
  let total = 0;

  for (const tableName of tables) {
    // Fetch records that need (re-)processing:
    // 1. counteragent_processed = false (normal case after the bug fix)
    // 2. counteragent_processed = true but counteragent_uuid IS NULL (stuck records from the old bug)
    const { data: unprocessedRows, error: err1 } = await supabase
      .from(tableName)
      .select(SELECT_COLUMNS)
      .in('counteragent_inn', normalizedInns)
      .eq('counteragent_processed', false);

    if (err1) throw err1;

    const { data: stuckRows, error: err2 } = await supabase
      .from(tableName)
      .select(SELECT_COLUMNS)
      .in('counteragent_inn', normalizedInns)
      .eq('counteragent_processed', true)
      .is('counteragent_uuid', null);

    if (err2) throw err2;

    const allRows = [...(unprocessedRows || []), ...(stuckRows || [])];
    const updated = await reparseRows(tableName, allRows, context);
    byTable[tableName] = updated;
    total += updated;
  }

  return { updated: total, byTable };
}
