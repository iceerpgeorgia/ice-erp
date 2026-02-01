import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getSupabaseClient,
  loadCounteragents,
  loadParsingRules,
  loadPayments,
  loadNBGRates,
  loadCurrencyCache,
} from '@/lib/bank-import/db-utils';
import {
  calculateNominalAmount,
  computeCaseDescription,
  processSingleRecord,
} from '@/lib/bank-import/import_bank_xml_data_deconsolidated';

const DECONSOLIDATED_TABLE = 'GE78BG0000000893486000_BOG_GEL';

const normalize = (value: any) => (value === undefined || value === null ? null : String(value));

const amountsEqual = (a: any, b: any) => {
  const numA = a === null || a === undefined ? null : Number(a);
  const numB = b === null || b === undefined ? null : Number(b);
  if (numA === null && numB === null) return true;
  if (numA === null || numB === null) return false;
  return Math.abs(numA - numB) < 0.01;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 200);
    const offset = Number(body.offset ?? 0);

    const supabase = getSupabaseClient();
    const [counteragentsMap, parsingRules, paymentsBundle, nbgRatesMap, currencyCache] = await Promise.all([
      loadCounteragents(supabase),
      loadParsingRules(supabase),
      loadPayments(supabase),
      loadNBGRates(supabase),
      loadCurrencyCache(supabase),
    ]);

      const { paymentsMap, salaryBaseMap, salaryLatestMap, duplicatePaymentMap } = paymentsBundle;

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
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
        doccomment,
        entrydbamt,
        entrycramt,
        account_currency_amount,
        account_currency_uuid,
        transaction_date,
        counteragent_uuid,
        counteragent_account_number,
        project_uuid,
        financial_code_uuid,
        nominal_currency_uuid,
        payment_id,
        applied_rule_id,
        counteragent_processed,
        parsing_rule_processed,
        payment_id_processed,
        processing_case,
        nominal_amount
      FROM "${DECONSOLIDATED_TABLE}"
      WHERE COALESCE(parsing_lock, false) = false
      ORDER BY id ASC
      LIMIT ${limit} OFFSET ${offset}`
    );

    const changes: any[] = [];

    for (const row of rows) {
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
            duplicatePaymentMap,
        salaryLatestMap,
        0,
        {
          case1_counteragent_processed: 0,
          case2_counteragent_inn_blank: 0,
          case3_counteragent_inn_nonblank_no_match: 0,
          case4_payment_id_match: 0,
          case5_payment_id_counteragent_mismatch: 0,
          case6_parsing_rule_match: 0,
          case7_parsing_rule_counteragent_mismatch: 0,
          case8_parsing_rule_dominance: 0,
        },
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

      const current = {
        counteragent_uuid: row.counteragent_uuid,
        counteragent_account_number: row.counteragent_account_number,
        project_uuid: row.project_uuid,
        financial_code_uuid: row.financial_code_uuid,
        nominal_currency_uuid: row.nominal_currency_uuid,
        payment_id: row.payment_id,
        applied_rule_id: row.applied_rule_id,
        counteragent_processed: row.counteragent_processed,
        parsing_rule_processed: row.parsing_rule_processed,
        payment_id_processed: row.payment_id_processed,
        processing_case: row.processing_case,
        nominal_amount: row.nominal_amount,
      };

      const next = {
        counteragent_uuid: result.counteragent_uuid,
        counteragent_account_number: result.counteragent_account_number,
        project_uuid: result.project_uuid,
        financial_code_uuid: result.financial_code_uuid,
        nominal_currency_uuid: nominalCurrencyUuid,
        payment_id: result.payment_id,
        applied_rule_id: result.applied_rule_id,
        counteragent_processed: result.case1_counteragent_processed,
        parsing_rule_processed: result.case6_parsing_rule_applied,
        payment_id_processed: result.case4_payment_id_matched,
        processing_case: caseDescription,
        nominal_amount: nominalAmount,
      };

      const changedFields: string[] = [];
      if (normalize(current.counteragent_uuid) !== normalize(next.counteragent_uuid)) changedFields.push('counteragent_uuid');
      if (normalize(current.counteragent_account_number) !== normalize(next.counteragent_account_number)) changedFields.push('counteragent_account_number');
      if (normalize(current.project_uuid) !== normalize(next.project_uuid)) changedFields.push('project_uuid');
      if (normalize(current.financial_code_uuid) !== normalize(next.financial_code_uuid)) changedFields.push('financial_code_uuid');
      if (normalize(current.nominal_currency_uuid) !== normalize(next.nominal_currency_uuid)) changedFields.push('nominal_currency_uuid');
      if (normalize(current.payment_id) !== normalize(next.payment_id)) changedFields.push('payment_id');
      if (normalize(current.applied_rule_id) !== normalize(next.applied_rule_id)) changedFields.push('applied_rule_id');
      if (Boolean(current.counteragent_processed) !== Boolean(next.counteragent_processed)) changedFields.push('counteragent_processed');
      if (Boolean(current.parsing_rule_processed) !== Boolean(next.parsing_rule_processed)) changedFields.push('parsing_rule_processed');
      if (Boolean(current.payment_id_processed) !== Boolean(next.payment_id_processed)) changedFields.push('payment_id_processed');
      if (normalize(current.processing_case) !== normalize(next.processing_case)) changedFields.push('processing_case');
      if (!amountsEqual(current.nominal_amount, next.nominal_amount)) changedFields.push('nominal_amount');

      if (changedFields.length > 0) {
        changes.push({
          id: row.id,
          uuid: row.uuid,
          transaction_date: row.transaction_date,
          description: row.docnomination || row.docinformation || null,
          changed_fields: changedFields,
          current,
          next,
        });
      }
    }

    return NextResponse.json({
      success: true,
      limit,
      offset,
      total: changes.length,
      changes,
    });
  } catch (error: any) {
    console.error('[POST /api/bank-transactions/backparse-preview] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to preview backparse' },
      { status: 500 }
    );
  }
}
