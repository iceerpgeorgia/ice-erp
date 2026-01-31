import { NextRequest, NextResponse } from 'next/server';
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
import type { ProcessingStats } from '@/lib/bank-import/types';

const DECONSOLIDATED_TABLE = 'GE78BG0000000893486000_BOG_GEL';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter((id: number) => Number.isFinite(id)) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No ids provided' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const [counteragentsMap, parsingRules, paymentsBundle, nbgRatesMap, currencyCache] = await Promise.all([
      loadCounteragents(supabase),
      loadParsingRules(supabase),
      loadPayments(supabase),
      loadNBGRates(supabase),
      loadCurrencyCache(supabase),
    ]);

    const { paymentsMap, salaryBaseMap, salaryLatestMap } = paymentsBundle;

    const { data: rows, error: fetchError } = await supabase
      .from(DECONSOLIDATED_TABLE)
      .select(
        'id,uuid,dockey,docsenderinn,docbenefinn,doccoracct,docsenderacctno,docbenefacctno,docprodgroup,docnomination,docinformation,entrydbamt,entrycramt,account_currency_amount,account_currency_uuid,transaction_date,parsing_lock'
      )
      .in('id', ids)
      .or('parsing_lock.is.null,parsing_lock.eq.false');

    if (fetchError) {
      throw fetchError;
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
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

    const { error: updateError } = await supabase
      .from(DECONSOLIDATED_TABLE)
      .upsert(updateRows, { onConflict: 'id' });

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, updated: updateRows.length });
  } catch (error: any) {
    console.error('[POST /api/bank-transactions/backparse-selected] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to backparse selection' },
      { status: 500 }
    );
  }
}
