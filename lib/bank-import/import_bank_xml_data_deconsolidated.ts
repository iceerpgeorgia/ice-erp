/**
 * Deconsolidated Bank XML Import - Single Table Storage
 * Stores raw + parsed columns into account-scoped table, e.g. GE78BG0000000893486000_BOG_GEL
 */

import { parseStringPromise } from 'xml2js';
import { v5 as uuidv5 } from 'uuid';
import {
  getSupabaseClient,
  loadCounteragents,
  loadParsingRules,
  loadPayments,
  loadNBGRates,
  loadCurrencyCache,
  normalizeINN,
  extractPaymentID,
} from './db-utils';
import { evaluateCondition } from '../formula-compiler';
import type {
  CounteragentData,
  ParsingRule,
  PaymentData,
  NBGRates,
  ProcessingResult,
  ProcessingStats,
  AccountInfo,
} from './types';

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function parseBOGDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const cleaned = dateStr.trim();
    const normalized = cleaned.length >= 10 ? cleaned.slice(0, 10) : cleaned;
    if (normalized.length === 10 && normalized.includes('.')) {
      const [day, month, year] = normalized.split('.');
      if (!day || !month || !year) return null;
      const date = new Date(`${year}-${month}-${day}`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (normalized.length === 10) {
      const date = new Date(normalized);
      return Number.isNaN(date.getTime()) ? null : date;
    } else if (normalized.length === 8) {
      const year = normalized.substring(0, 4);
      const month = normalized.substring(4, 6);
      const day = normalized.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  } catch {
    return null;
  }
}

export function calculateNominalAmount(
  accountCurrencyAmount: number,
  accountCurrencyCode: string,
  nominalCurrencyUuid: string | null,
  transactionDate: Date,
  nbgRatesMap: Map<string, NBGRates>,
  currencyCache: Map<string, string>
): number {
  if (!nominalCurrencyUuid) return accountCurrencyAmount;

  const nominalCurrencyCode = currencyCache.get(nominalCurrencyUuid);
  if (!nominalCurrencyCode) return accountCurrencyAmount;

  if (accountCurrencyCode === nominalCurrencyCode) {
    return accountCurrencyAmount;
  }

  const dateKey = transactionDate.toISOString().split('T')[0];
  const rates = nbgRatesMap.get(dateKey);
  if (!rates) return accountCurrencyAmount;

  if (accountCurrencyCode === 'GEL' && nominalCurrencyCode in rates) {
    const rate = rates[nominalCurrencyCode as keyof NBGRates];
    if (rate && rate > 0) {
      return accountCurrencyAmount / rate;
    }
  }

  if (accountCurrencyCode in rates && nominalCurrencyCode === 'GEL') {
    const rate = rates[accountCurrencyCode as keyof NBGRates];
    if (rate && rate > 0) {
      return accountCurrencyAmount * rate;
    }
  }

  if (accountCurrencyCode in rates && nominalCurrencyCode in rates) {
    const accountRate = rates[accountCurrencyCode as keyof NBGRates];
    const nominalRate = rates[nominalCurrencyCode as keyof NBGRates];
    if (accountRate && nominalRate && accountRate > 0 && nominalRate > 0) {
      return (accountCurrencyAmount * accountRate) / nominalRate;
    }
  }

  return accountCurrencyAmount;
}

export function computeCaseDescription(
  case1: boolean,
  case2: boolean,
  case3: boolean,
  case4: boolean,
  case5: boolean,
  case6: boolean,
  case7: boolean,
  case8: boolean,
  appliedRuleId: number | null = null
): string {
  const cases: string[] = [];

  if (case1) cases.push('Case1 - counteragent identified by INN');
  else if (case2) cases.push('Case2 - no INN in raw data');
  else if (case3) cases.push('Case3 - INN exists but no counteragent match');

  if (case6) {
    const ruleText = appliedRuleId
      ? `Case6 - parsing rule applied (ID: ${appliedRuleId})`
      : 'Case6 - parsing rule applied';
    cases.push(ruleText);
  } else if (case7) {
    cases.push('Case7 - parsing rule kept (INN conflict)');
  }

  if (case4) cases.push('Case4 - payment ID matched');
  else if (case5) cases.push('Case5 - payment ID conflict (Phase 1/2 kept)');

  if (case8) cases.push('Case8 - rule dominance (overrides payment)');

  return cases.length > 0 ? cases.join(' ') : 'No case matched';
}

function isValidSalaryPeriodSuffix(paymentId: string): boolean {
  const match = paymentId.match(/_PRL(\d{2})(\d{4})$/i);
  if (!match) return false;
  const month = Number(match[1]);
  const year = Number(match[2]);
  return month >= 1 && month <= 12 && year >= 2000 && year <= 2100;
}

function getSalaryBaseKey(paymentId: string): string | null {
  const trimmed = paymentId.trim();
  if (trimmed.length < 20) return null;
  return trimmed.slice(0, 20).toLowerCase();
}

function nextMonth(period: { month: number; year: number }): { month: number; year: number } {
  if (period.month === 12) {
    return { month: 1, year: period.year + 1 };
  }
  return { month: period.month + 1, year: period.year };
}

function formatSalaryPeriod(basePaymentId: string, period: { month: number; year: number }): string {
  const mm = String(period.month).padStart(2, '0');
  return `${basePaymentId}_PRL${mm}${period.year}`;
}

function evaluateParsingRuleCondition(condition: string | null, conditionScript: string | null, row: Record<string, any>): boolean {
  if (conditionScript && conditionScript.trim()) {
    return evaluateCondition(conditionScript, row);
  }

  if (!condition) return false;

  const normalized = condition.trim();
  const simpleMatch = normalized.match(/^(\w+)="([^"]+)"$/i);
  if (simpleMatch) {
    const [, columnName, expectedValue] = simpleMatch;
    const actualValue = row[columnName.toLowerCase()];
    return String(actualValue ?? '').trim() === expectedValue;
  }

  return false;
}

export function processSingleRecord(
  row: any,
  counteragentsMap: Map<string, CounteragentData>,
  parsingRules: ParsingRule[],
  paymentsMap: Map<string, PaymentData>,
  salaryBaseMap: Map<string, PaymentData>,
  salaryLatestMap: Map<string, { month: number; year: number; data: PaymentData }>,
  duplicatePaymentMap: Map<string, string>,
  idx: number,
  stats: ProcessingStats,
  missingCounteragents: Map<string, { inn: string; count: number; name: string }>
): ProcessingResult {
  const DocKey = row.dockey;
  const DocSenderInn = row.docsenderinn;
  const DocBenefInn = row.docbenefinn;
  const DocCorAcct = row.doccorracct;
  const DocSenderAcctNo = row.docsenderacctno;
  const DocBenefAcctNo = row.docbenefacctno;
  const DocProdGroup = row.docprodgroup;
  const DocNomination = row.docnomination;
  const DocInformation = row.docinformation;
  const debit = row.debit;

  const result: ProcessingResult = {
    counteragent_uuid: null,
    counteragent_account_number: null,
    counteragent_inn: null,
    project_uuid: null,
    financial_code_uuid: null,
    nominal_currency_uuid: null,
    payment_id: null,
    payment_accrual_source: null,
    applied_rule_id: null,
    case1_counteragent_processed: false,
    case1_counteragent_found: false,
    case3_counteragent_missing: false,
    case4_payment_id_matched: false,
    case5_payment_id_conflict: false,
    case6_parsing_rule_applied: false,
    case7_parsing_rule_conflict: false,
  };

  let counteragentAccountNumber: string | null = null;
  if (DocCorAcct && String(DocCorAcct).trim()) {
    counteragentAccountNumber = String(DocCorAcct).trim();
  }

  const isIncoming = debit === null || debit === 0;
  let counteragentInn: string | null = null;

  if (isIncoming) {
    counteragentInn = normalizeINN(DocSenderInn);
    if (!counteragentAccountNumber && DocSenderAcctNo && String(DocSenderAcctNo).trim()) {
      counteragentAccountNumber = String(DocSenderAcctNo).trim();
    }
  } else {
    counteragentInn = normalizeINN(DocBenefInn);
    if (!counteragentAccountNumber && DocBenefAcctNo && String(DocBenefAcctNo).trim()) {
      counteragentAccountNumber = String(DocBenefAcctNo).trim();
    }
  }

  result.counteragent_inn = counteragentInn;
  result.counteragent_account_number = counteragentAccountNumber;

  let matchedRule: ParsingRule | null = null;
  for (const rule of parsingRules) {
    const columnName = rule.column_name;
    const condition = rule.condition;
    const conditionScript = (rule as any).condition_script || null;
    const hasCondition = Boolean(condition && String(condition).trim());
    const hasConditionScript = Boolean(conditionScript && String(conditionScript).trim());
    if (!hasCondition && !hasConditionScript) continue;

    if (columnName) {
      const fieldMap: Record<string, any> = {
        docprodgroup: DocProdGroup,
        docnomination: DocNomination,
        docinformation: DocInformation,
        dockey: DocKey,
      };

      if (hasCondition) {
        const fieldValue = fieldMap[columnName.toLowerCase()];
        if (fieldValue && String(fieldValue).trim() === String(condition).trim()) {
          matchedRule = rule;
          break;
        }
      } else if (hasConditionScript) {
        const rowMap = {
          dockey: DocKey,
          docprodgroup: DocProdGroup,
          docnomination: DocNomination,
          docinformation: DocInformation,
        };
        if (evaluateParsingRuleCondition(null, conditionScript, rowMap)) {
          matchedRule = rule;
          break;
        }
      }
    } else {
      const rowMap = {
        dockey: DocKey,
        docprodgroup: DocProdGroup,
        docnomination: DocNomination,
        docinformation: DocInformation,
      };
      if (evaluateParsingRuleCondition(condition, conditionScript, rowMap)) {
        matchedRule = rule;
        break;
      }
    }
  }

  if (matchedRule) {
    const rulePaymentId = matchedRule.payment_id;
    let rulePaymentData: PaymentData | null = null;

    if (rulePaymentId) {
      const normalizedRuleId = rulePaymentId.toLowerCase();
      const mappedRuleId = duplicatePaymentMap.get(normalizedRuleId) || rulePaymentId;
      rulePaymentData = paymentsMap.get(mappedRuleId.toLowerCase()) || null;
    }

    result.applied_rule_id = matchedRule.id;
    result.case6_parsing_rule_applied = true;
    if (rulePaymentId) {
      const normalizedRuleId = rulePaymentId.toLowerCase();
      const mappedRuleId = duplicatePaymentMap.get(normalizedRuleId) || rulePaymentId;
      result.payment_id = mappedRuleId;
    }

    if (rulePaymentData) {
      if (rulePaymentData.counteragent_uuid) {
        result.counteragent_uuid = rulePaymentData.counteragent_uuid;
      }
      if (rulePaymentData.financial_code_uuid) {
        result.financial_code_uuid = rulePaymentData.financial_code_uuid;
      }
      if (rulePaymentData.project_uuid) {
        result.project_uuid = rulePaymentData.project_uuid;
      }
      if (rulePaymentData.currency_uuid) {
        result.nominal_currency_uuid = rulePaymentData.currency_uuid;
      }
      if (rulePaymentData.accrual_source) {
        result.payment_accrual_source = rulePaymentData.accrual_source;
      }
    }

    let ruleCounteragent = matchedRule.counteragent_uuid;
    if (!ruleCounteragent && rulePaymentData) {
      ruleCounteragent = rulePaymentData.counteragent_uuid;
    }

    if (ruleCounteragent && !result.counteragent_uuid) {
      result.counteragent_uuid = ruleCounteragent;
    }

    if (matchedRule.financial_code_uuid && !result.financial_code_uuid) {
      result.financial_code_uuid = matchedRule.financial_code_uuid;
    }

    if (matchedRule.nominal_currency_uuid && !result.nominal_currency_uuid) {
      result.nominal_currency_uuid = matchedRule.nominal_currency_uuid;
    }

    stats.case6_parsing_rule_match++;
  }

  if (!result.counteragent_uuid && counteragentInn) {
    const counteragentData = counteragentsMap.get(counteragentInn);
    if (counteragentData) {
      result.counteragent_uuid = counteragentData.uuid;
      result.case1_counteragent_processed = true;
      result.case1_counteragent_found = true;
      stats.case1_counteragent_processed++;
    } else {
      result.case1_counteragent_processed = true;
      result.case3_counteragent_missing = true;
      stats.case3_counteragent_inn_nonblank_no_match++;

      if (!missingCounteragents.has(counteragentInn)) {
        missingCounteragents.set(counteragentInn, {
          inn: counteragentInn,
          count: 0,
          name: 'Unknown',
        });
      }
      const entry = missingCounteragents.get(counteragentInn)!;
      entry.count++;
    }
  } else if (result.counteragent_uuid && counteragentInn) {
    const counteragentData = counteragentsMap.get(counteragentInn);
    if (counteragentData && counteragentData.uuid !== result.counteragent_uuid) {
      result.case7_parsing_rule_conflict = true;
      stats.case7_parsing_rule_counteragent_mismatch++;
    }
  }

  const extractedPaymentId = extractPaymentID(DocInformation || DocNomination);
  if (extractedPaymentId) {
    const paymentIdLower = extractedPaymentId.toLowerCase();
    const mappedPaymentId = duplicatePaymentMap.get(paymentIdLower) || extractedPaymentId;
    const mappedPaymentLower = mappedPaymentId.toLowerCase();
    let paymentData = paymentsMap.get(mappedPaymentLower) || null;
    let resolvedPaymentId = mappedPaymentId;

    if (!paymentData) {
      const baseKey = getSalaryBaseKey(mappedPaymentLower);
      if (baseKey && salaryBaseMap.has(baseKey)) {
        paymentData = salaryBaseMap.get(baseKey) || null;

        if (!isValidSalaryPeriodSuffix(mappedPaymentLower) && salaryLatestMap.has(baseKey)) {
          const latest = salaryLatestMap.get(baseKey)!;
          const next = nextMonth({ month: latest.month, year: latest.year });
          const baseOriginal = mappedPaymentId.trim().slice(0, 20);
          resolvedPaymentId = formatSalaryPeriod(baseOriginal, next);
        }
      }
    }

    if (paymentData) {
      if (
        result.counteragent_uuid &&
        paymentData.counteragent_uuid &&
        paymentData.counteragent_uuid !== result.counteragent_uuid
      ) {
        result.case5_payment_id_conflict = true;
        stats.case5_payment_id_counteragent_mismatch++;
      } else {
        if (!result.counteragent_uuid && paymentData.counteragent_uuid) {
          result.counteragent_uuid = paymentData.counteragent_uuid;
        }

        if (!result.financial_code_uuid && paymentData.financial_code_uuid) {
          result.financial_code_uuid = paymentData.financial_code_uuid;
        }

        if (!result.nominal_currency_uuid && paymentData.currency_uuid) {
          result.nominal_currency_uuid = paymentData.currency_uuid;
        }

        if (!result.project_uuid && paymentData.project_uuid) {
          result.project_uuid = paymentData.project_uuid;
        }
      }

      if (!result.case5_payment_id_conflict) {
        result.payment_id = resolvedPaymentId;
        result.case4_payment_id_matched = true;
        result.payment_accrual_source = paymentData.accrual_source ?? null;
      }

      stats.case4_payment_id_match++;

      if (idx <= 3) {
        console.log(`  💳 Record ${idx}: Payment ID matched: ${resolvedPaymentId}`);
      }
    }
  }

  return result;
}

async function identifyBOGGELAccount(xmlContent: string): Promise<AccountInfo | null> {
  try {
    const parsed = await parseStringPromise(xmlContent, {
      tagNameProcessors: [(name) => name.replace(/^[^:]+:/, '')],
    });

    let root = parsed.AccountStatement || parsed.STATEMENT || parsed.ROWDATA || parsed;

    if (root && typeof root === 'object' && !root.HEADER && !root.DETAILS && !root.DETAIL) {
      const keys = Object.keys(root);
      if (keys.length === 1) {
        root = root[keys[0]];
      }
    }

    const header = root?.HEADER?.[0];
    if (!header) {
      throw new Error('Invalid BOG GEL XML format - missing HEADER');
    }

    const accountInfoText = header.AcctNo?.[0] || '';
    const accountFull = accountInfoText.split(' ')[0];

    if (accountFull.length <= 3) {
      throw new Error('Invalid account number in XML');
    }

    const currencyCode = accountFull.substring(accountFull.length - 3);
    const accountNumber = accountFull
      .substring(0, accountFull.length - 3)
      .trim()
      .toUpperCase();

    return {
      account_number: accountNumber,
      currency_code: currencyCode,
      xml_root: root,
    };
  } catch (error: any) {
    console.log('⚠️ Could not parse as BOG GEL format:', error.message);
    return null;
  }
}

function resolveDeconsolidatedTableName(accountNumber: string, parsingScheme: string): string {
  const safeScheme = parsingScheme.replace(/[^A-Za-z0-9_]/g, '_');
  return `${accountNumber}_${safeScheme}`;
}

export async function processBOGGELDeconsolidated(
  xmlContent: string,
  accountUuid: string,
  accountNumber: string,
  currencyCode: string,
  importBatchId: string
): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 BOG GEL DECONSOLIDATED PROCESSING');
  console.log('='.repeat(80) + '\n');

  const supabase = getSupabaseClient();

  const { data: accountData, error: accountError } = await supabase
    .from('bank_accounts')
    .select('uuid, currency_uuid, parsing_scheme_uuid')
    .eq('uuid', accountUuid)
    .single();

  if (accountError || !accountData) {
    throw new Error(`Account UUID not found: ${accountUuid}`);
  }

  const bankAccountUuid = accountData.uuid;
  const accountCurrencyUuid = accountData.currency_uuid;

  const { data: schemeData } = await supabase
    .from('parsing_schemes')
    .select('scheme')
    .eq('uuid', accountData.parsing_scheme_uuid)
    .single();

  const scheme = !schemeData?.scheme
    ? (currencyCode === 'USD' ? 'BOG_USD' : 'BOG_GEL')
    : (schemeData.scheme === 'BOG_GEL' && currencyCode === 'USD')
      ? 'BOG_USD'
      : schemeData.scheme;
  const deconsolidatedTableName = resolveDeconsolidatedTableName(accountNumber, scheme);

  console.log(`📊 Bank Account UUID: ${bankAccountUuid}`);
  console.log(`💱 Account Currency UUID: ${accountCurrencyUuid}`);
  console.log(`📋 Target Table: ${deconsolidatedTableName}\n`);

  const accountInfo = await identifyBOGGELAccount(xmlContent);
  if (!accountInfo) {
    throw new Error('Failed to parse XML');
  }

  const detailsContainer = accountInfo.xml_root.DETAILS?.[0] || accountInfo.xml_root;
  const details = detailsContainer.DETAIL || [];
  console.log(`📦 Found ${details.length} transactions in XML\n`);

  console.log('\n' + '='.repeat(80));
  console.log('🔄 STEP 1: LOADING DICTIONARIES');
  console.log('='.repeat(80) + '\n');

  const [counteragentsMap, parsingRules, paymentsBundle, nbgRatesMap, currencyCache] =
    await Promise.all([
      loadCounteragents(supabase),
      loadParsingRules(supabase),
      loadPayments(supabase),
      loadNBGRates(supabase),
      loadCurrencyCache(supabase),
    ]);

  const { paymentsMap, salaryBaseMap, salaryLatestMap, duplicatePaymentMap } = paymentsBundle;

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

  const missingCounteragents = new Map<
    string,
    { inn: string; count: number; name: string }
  >();

  const insertRecords: any[] = [];
  let skippedDuplicates = 0;
  let skippedMissingKeys = 0;
  let skippedInvalidDates = 0;
  const detailMeta: Array<{
    detail: any;
    DocKey: string;
    EntriesId: string;
    recordUuid: string;
  }> = [];

  for (let idx = 0; idx < details.length; idx++) {
    const detail = details[idx];
    const getText = (tagName: string) => detail[tagName]?.[0] || null;

    const DocKey = getText('DocKey');
    const EntriesId = getText('EntriesId');

    if (!DocKey || !EntriesId) {
      skippedMissingKeys++;
      continue;
    }

    const recordUuidStr = `${DocKey}_${EntriesId}`;
    const recordUuid = uuidv5(recordUuidStr, DNS_NAMESPACE);
    detailMeta.push({ detail, DocKey, EntriesId, recordUuid });
  }

  console.log(`🔎 Checking existing records in ${deconsolidatedTableName}...`);
  const existingUuids = new Set<string>();
  const existingBatchSize = 200;

  for (let i = 0; i < detailMeta.length; i += existingBatchSize) {
    const batch = detailMeta.slice(i, i + existingBatchSize);
    const batchUuids = batch.map((item) => item.recordUuid);

    const { data, error } = await supabase
      .from(deconsolidatedTableName)
      .select('uuid')
      .in('uuid', batchUuids);

    if (error) throw error;
    for (const row of data ?? []) {
      existingUuids.add(row.uuid);
    }
  }

  console.log(`  ✅ Found ${existingUuids.size} existing records in table`);
  const { data: maxIdData, error: maxIdError } = await supabase
    .from(deconsolidatedTableName)
    .select('id')
    .order('id', { ascending: false })
    .limit(1);

  if (maxIdError) throw maxIdError;
  let nextId = Number(maxIdData?.[0]?.id ?? 0);

  const startTime = Date.now();
  const nowIso = new Date().toISOString();
  const importDateStr = nowIso.split('T')[0];

  for (let idx = 0; idx < detailMeta.length; idx++) {
    const { detail, DocKey, EntriesId, recordUuid } = detailMeta[idx];
    const getText = (tagName: string) => detail[tagName]?.[0] || null;

    if (existingUuids.has(recordUuid)) {
      skippedDuplicates++;
      continue;
    }

    const entryCrAmt = getText('EntryCrAmt');
    const entryDbAmt = getText('EntryDbAmt');
    const credit = entryCrAmt ? parseFloat(entryCrAmt) : 0;
    const debit = entryDbAmt ? parseFloat(entryDbAmt) : 0;
    const accountCurrencyAmount = credit - debit;

    const docValueDate = getText('DocValueDate');
    const docActualDate = getText('DocActualDate');
    const docRecDate = getText('DocRecDate');
    const transactionDate = parseBOGDate(docValueDate || docActualDate || docRecDate);
    if (!transactionDate) {
      skippedInvalidDates++;
      continue;
    }

    const row = {
      dockey: DocKey,
      entriesid: EntriesId,
      docsenderinn: getText('DocSenderInn'),
      docbenefinn: getText('DocBenefInn'),
      doccorracct: getText('DocCorAcct'),
      docsenderacctno: getText('DocSenderAcctNo'),
      docbenefacctno: getText('DocBenefAcctNo'),
      docprodgroup: getText('DocProdGroup'),
      docnomination: getText('DocNomination'),
      docinformation: getText('DocInformation'),
      debit: debit,
    };

    const result = processSingleRecord(
      row,
      counteragentsMap,
      parsingRules,
      paymentsMap,
      salaryBaseMap,
      salaryLatestMap,
      duplicatePaymentMap,
      idx + 1,
      stats,
      missingCounteragents
    );

    const nominalCurrencyUuid = result.nominal_currency_uuid || accountCurrencyUuid;
    const nominalAmount = calculateNominalAmount(
      accountCurrencyAmount,
      currencyCode,
      nominalCurrencyUuid,
      transactionDate,
      nbgRatesMap,
      currencyCache
    );

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

    nextId += 1;
    insertRecords.push({
      id: nextId,
      uuid: recordUuid,
      import_date: importDateStr,
      created_at: nowIso,
      updated_at: nowIso,
      cancopydocument: getText('CanCopyDocument'),
      canviewdocument: getText('CanViewDocument'),
      canprintdocument: getText('CanPrintDocument'),
      isreval: getText('IsReval'),
      docnomination: getText('DocNomination'),
      docinformation: getText('DocInformation'),
      docsrcamt: getText('DocSrcAmt'),
      docsrcccy: getText('DocSrcCcy'),
      docdstamt: getText('DocDstAmt'),
      docdstccy: getText('DocDstCcy'),
      dockey: DocKey,
      docrecdate: getText('DocRecDate'),
      docbranch: getText('DocBranch'),
      docdepartment: getText('DocDepartment'),
      docprodgroup: getText('DocProdGroup'),
      docno: getText('DocNo'),
      docvaluedate: getText('DocValueDate'),
      docsendername: getText('DocSenderName'),
      docsenderinn: getText('DocSenderInn'),
      docsenderacctno: getText('DocSenderAcctNo'),
      docsenderbic: getText('DocSenderBic'),
      docactualdate: getText('DocActualDate'),
      doccoracct: getText('DocCorAcct'),
      doccorbic: getText('DocCorBic'),
      doccorbankname: getText('DocCorBankName'),
      entriesid: EntriesId,
      doccomment: getText('DocComment'),
      ccyrate: getText('CcyRate'),
      entrypdate: getText('EntryPDate'),
      entrydocno: getText('EntryDocNo'),
      entrylacct: getText('EntryLAcct'),
      entrylacctold: getText('EntryLAcctOld'),
      entrydbamt: entryDbAmt,
      entrydbamtbase: getText('EntryDbAmtBase'),
      entrycramt: entryCrAmt,
      entrycramtbase: getText('EntryCrAmtBase'),
      outbalance: getText('OutBalance'),
      entryamtbase: getText('EntryAmtBase'),
      entrycomment: getText('EntryComment'),
      entrydepartment: getText('EntryDepartment'),
      entryacctpoint: getText('EntryAcctPoint'),
      docsenderbicname: getText('DocSenderBicName'),
      docbenefname: getText('DocBenefName'),
      docbenefinn: getText('DocBenefInn'),
      docbenefacctno: getText('DocBenefAcctNo'),
      docbenefbic: getText('DocBenefBic'),
      docbenefbicname: getText('DocBenefBicName'),
      docpayername: getText('DocPayerName'),
      docpayerinn: getText('DocPayerInn'),
      import_batch_id: importBatchId,
      counteragent_processed: result.case1_counteragent_processed,
      parsing_rule_processed: result.case6_parsing_rule_applied,
      payment_id_processed: result.case4_payment_id_matched,
      is_processed: Boolean(result.case1_counteragent_processed && result.case6_parsing_rule_applied && result.case4_payment_id_matched),
      counteragent_inn: result.counteragent_inn,
      applied_rule_id: result.applied_rule_id,
      processing_case: caseDescription,
      bank_account_uuid: bankAccountUuid,
      raw_record_uuid: recordUuid,
      transaction_date: transactionDate.toISOString().split('T')[0],
      description: getText('DocNomination'),
      counteragent_uuid: result.counteragent_uuid,
      counteragent_account_number: result.counteragent_account_number,
      project_uuid: result.project_uuid,
      financial_code_uuid: result.financial_code_uuid,
      payment_id: result.payment_id,
      account_currency_uuid: accountCurrencyUuid,
      account_currency_amount: accountCurrencyAmount,
      nominal_currency_uuid: nominalCurrencyUuid,
      nominal_amount: nominalAmount,
      correction_date: null,
      exchange_rate: getText('CcyRate') ? Number(getText('CcyRate')) : null,
    });

    if ((idx + 1) % 500 === 0 || idx + 1 === detailMeta.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `  ✅ Processed ${idx + 1}/${detailMeta.length} valid records (${elapsed}s) | new: ${insertRecords.length}, dup: ${skippedDuplicates}, missing: ${skippedMissingKeys}, invalidDates: ${skippedInvalidDates}`
      );
    }

    if ((idx + 1) % 1000 === 0 || idx + 1 === detailMeta.length) {
      console.log(
        `  ✅ Processed ${idx + 1}/${detailMeta.length} valid records | queued: ${insertRecords.length} | duplicates: ${skippedDuplicates} | missing keys: ${skippedMissingKeys} | invalid dates: ${skippedInvalidDates}`
      );
    }
  }

  console.log(`📊 Raw Data Import Results:`);
  console.log(`  ✅ New records to insert: ${insertRecords.length}`);
  console.log(`  🔄 Skipped duplicates: ${skippedDuplicates}`);
  console.log(`  ⚠️  Skipped missing keys: ${skippedMissingKeys}\n`);
  console.log(`  ⚠️  Skipped invalid dates: ${skippedInvalidDates}\n`);

  if (insertRecords.length > 0) {
    console.log(`💾 Inserting ${insertRecords.length} records into ${deconsolidatedTableName}...`);
    const insertBatchSize = 1000;

    for (let i = 0; i < insertRecords.length; i += insertBatchSize) {
      const batch = insertRecords.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabase
        .from(deconsolidatedTableName)
        .insert(batch);

      if (insertError) throw insertError;
      console.log(`  ✅ Inserted ${Math.min(i + insertBatchSize, insertRecords.length)}/${insertRecords.length}`);
    }

    console.log(`✅ Inserted ${insertRecords.length} records\n`);
  } else {
    console.log('⚠️ No new records to insert\n');
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80) + '\n');
  console.log('📋 Phase 1 - Parsing Rules:');
  console.log(`  ✅ Rules applied: ${stats.case6_parsing_rule_match}`);
  console.log(`  ⚠️  Conflicts (kept rule): ${stats.case7_parsing_rule_counteragent_mismatch}\n`);
  console.log('📋 Phase 2 - Counteragent Identification:');
  console.log(`  ✅ Case 1 (Counteragent matched): ${stats.case1_counteragent_processed}`);
  console.log(`  ⚠️  Case 3 (INN no match): ${stats.case3_counteragent_inn_nonblank_no_match}`);
  console.log(`  ℹ️  Case 2 (INN blank): ${stats.case2_counteragent_inn_blank}\n`);
  console.log('📋 Phase 3 - Payment ID:');
  console.log(`  ✅ Payment matched: ${stats.case4_payment_id_match}`);
  console.log(`  ⚠️  Conflicts (kept Phase 1/2): ${stats.case5_payment_id_counteragent_mismatch}\n`);
  console.log('📊 Overall:');
  console.log(`  📦 Total records: ${insertRecords.length}\n`);

  if (missingCounteragents.size > 0) {
    console.log(`⚠️  CASE 3 REPORT - INNs needing counteragents (${missingCounteragents.size}):`);
    console.log('━'.repeat(80));
    const sorted = Array.from(missingCounteragents.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    for (const data of sorted) {
      console.log(`  INN: ${data.inn} | Count: ${data.count}`);
    }
    if (missingCounteragents.size > 10) {
      console.log(`  ... and ${missingCounteragents.size - 10} more`);
    }
    console.log('━'.repeat(80));
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Deconsolidated import completed successfully!');
  console.log('='.repeat(80) + '\n');
}
