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
  ensureNBGRatesExist,
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

function formatDateKey(date: Date | null): string | null {
  return date ? date.toISOString().split('T')[0] : null;
}

function deriveBOGTransactionDate(getText: (tagName: string) => string | null): Date | null {
  // Prefer posting/completion date so overnight pending records are eventually assigned
  // to the day they actually post in statements.
  return (
    parseBOGDate(getText('EntryPDate') || undefined) ||
    parseBOGDate(getText('DocRecDate') || undefined) ||
    parseBOGDate(getText('DocActualDate') || undefined) ||
    parseBOGDate(getText('DocValueDate') || undefined)
  );
}

export function calculateNominalAmount(
  accountCurrencyAmount: number,
  accountCurrencyCode: string,
  nominalCurrencyUuid: string | null,
  transactionDate: Date,
  nbgRatesMap: Map<string, NBGRates>,
  currencyCache: Map<string, string>,
  missingRateDates?: Set<string>
): number {
  if (!nominalCurrencyUuid) return accountCurrencyAmount;

  const nominalCurrencyCode = currencyCache.get(nominalCurrencyUuid);
  if (!nominalCurrencyCode) return accountCurrencyAmount;

  if (accountCurrencyCode === nominalCurrencyCode) {
    return accountCurrencyAmount;
  }

  const dateKey = transactionDate.toISOString().split('T')[0];
  let rates = nbgRatesMap.get(dateKey);
  if (!rates) {
    // Fallback: search up to 7 previous days for the nearest available rate
    const d = new Date(dateKey + 'T00:00:00Z');
    for (let i = 1; i <= 7; i++) {
      d.setUTCDate(d.getUTCDate() - 1);
      const fallbackKey = d.toISOString().split('T')[0];
      rates = nbgRatesMap.get(fallbackKey);
      if (rates) break;
    }
    if (!rates) {
      if (missingRateDates) missingRateDates.add(dateKey);
      return accountCurrencyAmount;
    }
  }

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

  if (missingRateDates) missingRateDates.add(dateKey);
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
      result.case1_counteragent_processed = false;
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

  const defaultSchemeByCurrency = (code: string) => {
    if (code === 'USD') return 'BOG_USD';
    if (code === 'EUR') return 'BOG_EUR';
    if (code === 'AED') return 'BOG_AED';
    if (code === 'GBP') return 'BOG_GBP';
    if (code === 'KZT') return 'BOG_KZT';
    if (code === 'CNY') return 'BOG_CNY';
    if (code === 'TRY') return 'BOG_TRY';
    return 'BOG_GEL';
  };

  let schemeData: { scheme?: string } | null = null;
  if (accountData.parsing_scheme_uuid) {
    const { data } = await supabase
      .from('parsing_schemes')
      .select('scheme')
      .eq('uuid', accountData.parsing_scheme_uuid)
      .single();
    schemeData = data;
  }

  const normalizeBogScheme = (rawScheme: string | undefined, ccy: string) => {
    const fallback = defaultSchemeByCurrency(ccy);
    const scheme = String(rawScheme || '').trim().toUpperCase();
    if (!scheme) return fallback;

    // Legacy/generic BOG schemes must resolve to currency-specific tables.
    if (scheme === 'BOG_FX' || scheme === 'BOG' || scheme === 'BOG_GEL' || scheme === 'BOG_USD' || scheme === 'BOG_EUR' || scheme === 'BOG_AED' || scheme === 'BOG_GBP' || scheme === 'BOG_KZT' || scheme === 'BOG_CNY' || scheme === 'BOG_TRY') {
      return fallback;
    }

    return scheme;
  };

  const scheme = normalizeBogScheme(schemeData?.scheme, currencyCode);
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

  // Pre-check: ensure NBG exchange rates exist for all transaction dates
  const transactionDates = new Set<string>();
  for (const detail of details) {
    const getText = (tagName: string) => detail[tagName]?.[0] || null;
    const date = deriveBOGTransactionDate(getText);
    if (date) {
      transactionDates.add(date.toISOString().split('T')[0]);
    }
  }
  if (transactionDates.size > 0) {
    await ensureNBGRatesExist(supabase, [...transactionDates]);
  }

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

  const { data: bankAccountsData, error: bankAccountsError } = await supabase
    .from('bank_accounts')
    .select('uuid, account_number, currency_uuid, bank_uuid, insider_uuid');
  if (bankAccountsError) throw bankAccountsError;

  const bankAccountsMap = new Map<
    string,
    {
      uuid: string;
      account_number: string;
      currency_uuid: string;
      currency_code: string;
      bank_uuid: string | null;
      insider_uuid: string | null;
    }
  >();
  const bankAccountsByNumber = new Map<
    string,
    {
      uuid: string;
      account_number: string;
      currency_uuid: string;
      currency_code: string;
      bank_uuid: string | null;
      insider_uuid: string | null;
    }
  >();
  const bankAccountsByUuid = new Map<
    string,
    {
      uuid: string;
      account_number: string;
      currency_uuid: string;
      currency_code: string;
      bank_uuid: string | null;
      insider_uuid: string | null;
    }
  >();
  const bankAccountTableNames = new Set<string>();

  const { data: bogBank } = await supabase
    .from('banks')
    .select('uuid')
    .eq('bank_name', 'BOG')
    .maybeSingle();
  const bogBankUuid = bogBank?.uuid ?? null;

  for (const row of bankAccountsData ?? []) {
    const currencyCode = currencyCache.get(row.currency_uuid) || '';
    const accountNumber = String(row.account_number || '').trim();
    if (!accountNumber || !currencyCode) continue;
    const key = `${accountNumber}_${currencyCode}`;
    bankAccountsMap.set(key, {
      uuid: row.uuid,
      account_number: accountNumber,
      currency_uuid: row.currency_uuid,
      currency_code: currencyCode,
      bank_uuid: row.bank_uuid ?? null,
      insider_uuid: row.insider_uuid ?? null,
    });
    bankAccountsByUuid.set(row.uuid, {
      uuid: row.uuid,
      account_number: accountNumber,
      currency_uuid: row.currency_uuid,
      currency_code: currencyCode,
      bank_uuid: row.bank_uuid ?? null,
      insider_uuid: row.insider_uuid ?? null,
    });
    bankAccountTableNames.add(resolveDeconsolidatedTableName(accountNumber, defaultSchemeByCurrency(currencyCode)));
    if (!bankAccountsByNumber.has(accountNumber)) {
      bankAccountsByNumber.set(accountNumber, {
        uuid: row.uuid,
        account_number: accountNumber,
        currency_uuid: row.currency_uuid,
        currency_code: currencyCode,
        bank_uuid: row.bank_uuid ?? null,
        insider_uuid: row.insider_uuid ?? null,
      });
    }
  }

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

  const conversionCandidates = new Map<string, {
    dockey: string;
    date: Date;
    senderAcctNo: string;
    benefAcctNo: string;
    docSrcAmt: string | null;
    docDstAmt: string | null;
    docSrcCcy: string | null;
    docDstCcy: string | null;
  }>();

  const insertRecords: any[] = [];
  let skippedDuplicates = 0;
  let skippedMissingKeys = 0;
  let skippedNoCompletionDate = 0;
  let skippedInvalidDates = 0;
  let updatedPendingToCompleted = 0;
  let deletedCanceled = 0;
  let correctedDuplicateDates = 0;
  const missingNbgRateDates = new Set<string>();
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

    // Skip pending/incomplete records that do not yet have posting/completion date.
    const completionDate = parseBOGDate(getText('EntryPDate') || undefined);
    if (!completionDate) {
      skippedNoCompletionDate++;
      continue;
    }

    const recordUuidStr = `${DocKey}_${EntriesId}`;
    const recordUuid = uuidv5(recordUuidStr, DNS_NAMESPACE);
    detailMeta.push({ detail, DocKey, EntriesId, recordUuid });
  }

  console.log(`🔎 Checking existing records in ${deconsolidatedTableName}...`);
  const existingUuids = new Set<string>();
  const existingRowsByUuid = new Map<string, { transaction_date: string | null }>();
  const existingBatchSize = 200;

  for (let i = 0; i < detailMeta.length; i += existingBatchSize) {
    const batch = detailMeta.slice(i, i + existingBatchSize);
    const batchUuids = batch.map((item) => item.recordUuid);

    const { data, error } = await supabase
      .from(deconsolidatedTableName)
      .select('uuid, transaction_date')
      .in('uuid', batchUuids);

    if (error) throw error;
    for (const row of data ?? []) {
      existingUuids.add(row.uuid);
      existingRowsByUuid.set(row.uuid, {
        transaction_date: row.transaction_date ? String(row.transaction_date).split('T')[0] : null,
      });
    }
  }

  console.log(`  ✅ Found ${existingUuids.size} existing records in table`);

  // --- Pending→Completed detection ---
  // Build maps from XML: DocKey → Array of entries (handles multiple entries per DocKey, e.g. TRN + COM)
  const xmlDocKeys = new Set<string>(detailMeta.map((m) => m.DocKey));
  // Store ALL entries per DocKey (not just max EntriesId) for proper pending→completed matching
  const xmlDocKeyEntries = new Map<string, Array<{ entriesId: string; uuid: string; date: string | null; amount: number; counteragent: string }>>();

  for (const m of detailMeta) {
    const getText = (tagName: string) => m.detail[tagName]?.[0] || null;
    // Parse date, amount, and counteragent for comparison
    const parsedDate = deriveBOGTransactionDate(getText);
    const entryCrAmt = getText('EntryCrAmt');
    const entryDbAmt = getText('EntryDbAmt');
    const credit = entryCrAmt ? parseFloat(entryCrAmt) : 0;
    const debit = entryDbAmt ? parseFloat(entryDbAmt) : 0;
    const counteragent = getText('DocBenefName') || getText('DocSenderName') || '';
    const entry = {
      entriesId: m.EntriesId,
      uuid: m.recordUuid,
      date: parsedDate ? parsedDate.toISOString().split('T')[0] : null,
      amount: credit - debit,
      counteragent,
    };
    if (!xmlDocKeyEntries.has(m.DocKey)) {
      xmlDocKeyEntries.set(m.DocKey, []);
    }
    xmlDocKeyEntries.get(m.DocKey)!.push(entry);
  }

  // Find existing records with same DocKey but different EntriesId (pending→completed)
  // Strict: must also have same date and same amount
  // Handles multiple entries per DocKey (e.g. TRN + COM) by matching each DB record
  // against the XML entry with the same date+amount and highest EntriesId
  const pendingToDelete: string[] = []; // uuids of old pending records to delete
  const allXmlDocKeysArr = Array.from(xmlDocKeys);
  const docKeyBatchSize = 200;

  for (let i = 0; i < allXmlDocKeysArr.length; i += docKeyBatchSize) {
    const batch = allXmlDocKeysArr.slice(i, i + docKeyBatchSize);
    const { data, error } = await supabase
      .from(deconsolidatedTableName)
      .select('uuid, dockey, entriesid, transaction_date, account_currency_amount, docbenefname, docsendername')
      .in('dockey', batch);

    if (error) throw error;
    for (const row of data ?? []) {
      const xmlEntries = xmlDocKeyEntries.get(row.dockey);
      if (!xmlEntries) continue;
      
      const dbDate = row.transaction_date ? String(row.transaction_date).split('T')[0] : null;
      const dbAmount = Number(row.account_currency_amount);
      
      // Find XML entry with same date+amount but different (higher) EntriesId
      // This properly handles DocKeys with multiple entries (TRN + COM)
      const matchingXmlEntry = xmlEntries.find((xmlEntry) =>
        xmlEntry.entriesId !== row.entriesid &&
        xmlEntry.uuid !== row.uuid &&
        xmlEntry.date === dbDate &&
        xmlEntry.amount === dbAmount &&
        xmlEntry.entriesId > row.entriesid // completed version has higher EntriesId
      );
      
      if (matchingXmlEntry) {
        // Confirmed pending→completed: same DocKey, date, amount, diff EntriesId
        pendingToDelete.push(row.uuid);
        existingUuids.delete(matchingXmlEntry.uuid);
        const dbCounteragent = row.docbenefname || row.docsendername || '';
        console.log(`  🔄 Pending→Completed: DocKey=${row.dockey}`);
        console.log(`     OLD (pending):    ID1=${row.dockey} | ID2=${row.entriesid} | UUID=${row.uuid}`);
        console.log(`                       Date=${dbDate} | Amount=${row.account_currency_amount} | Counteragent=${dbCounteragent}`);
        console.log(`     NEW (completed):  ID1=${row.dockey} | ID2=${matchingXmlEntry.entriesId} | UUID=${matchingXmlEntry.uuid}`);
        console.log(`                       Date=${matchingXmlEntry.date} | Amount=${matchingXmlEntry.amount} | Counteragent=${matchingXmlEntry.counteragent}`);
      }
    }
  }

  if (pendingToDelete.length > 0) {
    console.log(`  🔄 Total: ${pendingToDelete.length} pending→completed records to replace`);
    // Delete old pending records in batches
    for (let i = 0; i < pendingToDelete.length; i += docKeyBatchSize) {
      const batch = pendingToDelete.slice(i, i + docKeyBatchSize);
      const { error: delError } = await supabase
        .from(deconsolidatedTableName)
        .delete()
        .in('uuid', batch);
      if (delError) throw delError;
    }
    updatedPendingToCompleted = pendingToDelete.length;
    console.log(`  ✅ Deleted ${updatedPendingToCompleted} old pending records (will be replaced by completed versions)`);
  }

  // --- Canceled record detection ---
  // Determine the date range covered by this XML upload
  const xmlDates: Date[] = [];
  for (const m of detailMeta) {
    const getText = (tagName: string) => m.detail[tagName]?.[0] || null;
    const parsed = deriveBOGTransactionDate(getText);
    if (parsed) xmlDates.push(parsed);
  }

  if (xmlDates.length > 0) {
    const minDate = new Date(Math.min(...xmlDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...xmlDates.map((d) => d.getTime())));
    const minDateStr = minDate.toISOString().split('T')[0];
    const maxDateStr = maxDate.toISOString().split('T')[0];
    console.log(`  📅 XML date range: ${minDateStr} to ${maxDateStr}`);

    // Find DB records in that date range that are NOT in the XML → canceled
    const { data: dbRecordsInRange, error: rangeError } = await supabase
      .from(deconsolidatedTableName)
      .select('uuid, dockey, entriesid, transaction_date, account_currency_amount, docbenefname, docsendername, parsing_lock, conversion_id')
      .gte('transaction_date', minDateStr)
      .lte('transaction_date', maxDateStr);

    if (rangeError) throw rangeError;

    const canceledUuids: string[] = [];
    for (const dbRow of dbRecordsInRange ?? []) {
      // Skip records with parsing_lock (manually edited) or conversion_id (linked to conversion)
      if (dbRow.parsing_lock || dbRow.conversion_id) continue;
      // If this DocKey is NOT in the XML, the transaction was canceled
      if (!xmlDocKeys.has(dbRow.dockey)) {
        canceledUuids.push(dbRow.uuid);
        const counteragentName = dbRow.docbenefname || dbRow.docsendername || '';
        if (canceledUuids.length <= 10) {
          console.log(`  ❌ Canceled: DocKey=${dbRow.dockey} | Date=${dbRow.transaction_date} | Amount=${dbRow.account_currency_amount} | ${counteragentName}`);
        }
      }
    }

    if (canceledUuids.length > 10) {
      console.log(`  ... and ${canceledUuids.length - 10} more canceled records`);
    }

    if (canceledUuids.length > 0) {
      console.log(`  🗑️  Deleting ${canceledUuids.length} canceled records...`);
      for (let i = 0; i < canceledUuids.length; i += docKeyBatchSize) {
        const batch = canceledUuids.slice(i, i + docKeyBatchSize);
        const { error: delError } = await supabase
          .from(deconsolidatedTableName)
          .delete()
          .in('uuid', batch);
        if (delError) throw delError;
      }
      deletedCanceled = canceledUuids.length;
      console.log(`  ✅ Deleted ${deletedCanceled} canceled records`);
    } else {
      console.log(`  ✅ No canceled records found in date range`);
    }
  }
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
  const duplicateDateCorrections: Array<{ uuid: string; dockey: string; entriesid: string; fromDate: string | null; toDate: string }> = [];
  const duplicateDateCorrectionsSeen = new Set<string>();

  for (let idx = 0; idx < detailMeta.length; idx++) {
    const { detail, DocKey, EntriesId, recordUuid } = detailMeta[idx];
    const getText = (tagName: string) => detail[tagName]?.[0] || null;

    const entryCrAmt = getText('EntryCrAmt');
    const entryDbAmt = getText('EntryDbAmt');
    const credit = entryCrAmt ? parseFloat(entryCrAmt) : 0;
    const debit = entryDbAmt ? parseFloat(entryDbAmt) : 0;
    const accountCurrencyAmount = credit - debit;

    const transactionDate = deriveBOGTransactionDate(getText);
    if (!transactionDate) {
      skippedInvalidDates++;
      continue;
    }

    if (existingUuids.has(recordUuid)) {
      skippedDuplicates++;
      const dbDate = existingRowsByUuid.get(recordUuid)?.transaction_date ?? null;
      const newDate = formatDateKey(transactionDate);
      if (!duplicateDateCorrectionsSeen.has(recordUuid) && newDate && dbDate !== newDate) {
        duplicateDateCorrectionsSeen.add(recordUuid);
        duplicateDateCorrections.push({
          uuid: recordUuid,
          dockey: DocKey,
          entriesid: EntriesId,
          fromDate: dbDate,
          toDate: newDate,
        });
      }
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

    const senderAcctNo = getText('DocSenderAcctNo');
    const benefAcctNo = getText('DocBenefAcctNo');
    const docSrcAmt = getText('DocSrcAmt');
    const docDstAmt = getText('DocDstAmt');
    const docSrcCcy = getText('DocSrcCcy');
    const docDstCcy = getText('DocDstCcy');
    const docNomination = getText('DocNomination');
    const docInformation = getText('DocInformation');
    const srcCcyNorm = docSrcCcy ? String(docSrcCcy).trim().toUpperCase() : null;
    const dstCcyNorm = docDstCcy ? String(docDstCcy).trim().toUpperCase() : null;
    const hasCrossCurrencyMetadata = Boolean(srcCcyNorm && dstCcyNorm && srcCcyNorm !== dstCcyNorm);
    const hasConversionLikeText = hasConversionHint(docNomination) || hasConversionHint(docInformation);

    if (
      senderAcctNo &&
      benefAcctNo &&
      docSrcAmt &&
      docDstAmt &&
      docSrcCcy &&
      docDstCcy &&
      (hasCrossCurrencyMetadata || hasConversionLikeText) &&
      !conversionCandidates.has(DocKey)
    ) {
      conversionCandidates.set(DocKey, {
        dockey: DocKey,
        date: transactionDate,
        senderAcctNo: String(senderAcctNo).trim(),
        benefAcctNo: String(benefAcctNo).trim(),
        docSrcAmt,
        docDstAmt,
        docSrcCcy: srcCcyNorm,
        docDstCcy: dstCcyNorm,
      });
    }

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
      currencyCache,
      missingNbgRateDates
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
      conversion_id: null,
    });

    if ((idx + 1) % 500 === 0 || idx + 1 === detailMeta.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `  ✅ Processed ${idx + 1}/${detailMeta.length} valid records (${elapsed}s) | new: ${insertRecords.length}, dup: ${skippedDuplicates}, missing: ${skippedMissingKeys}, noCompletionDate: ${skippedNoCompletionDate}, invalidDates: ${skippedInvalidDates}`
      );
    }

    if ((idx + 1) % 1000 === 0 || idx + 1 === detailMeta.length) {
      console.log(
        `  ✅ Processed ${idx + 1}/${detailMeta.length} valid records | queued: ${insertRecords.length} | duplicates: ${skippedDuplicates} | missing keys: ${skippedMissingKeys} | no completion date: ${skippedNoCompletionDate} | invalid dates: ${skippedInvalidDates}`
      );
    }
  }

  if (duplicateDateCorrections.length > 0) {
    console.log(`  🛠️ Correcting transaction_date on ${duplicateDateCorrections.length} duplicate records...`);
    for (const item of duplicateDateCorrections) {
      const { error: updateError } = await supabase
        .from(deconsolidatedTableName)
        .update({ transaction_date: item.toDate, updated_at: nowIso })
        .eq('uuid', item.uuid);

      if (updateError) throw updateError;
      correctedDuplicateDates++;
      existingRowsByUuid.set(item.uuid, { transaction_date: item.toDate });
    }

    for (const item of duplicateDateCorrections.slice(0, 10)) {
      console.log(
        `    🔁 ${item.dockey}/${item.entriesid}: ${item.fromDate ?? 'null'} -> ${item.toDate}`
      );
    }
    if (duplicateDateCorrections.length > 10) {
      console.log(`    ... and ${duplicateDateCorrections.length - 10} more date corrections`);
    }
  }

  console.log(`📊 Raw Data Import Results:`);
  console.log(`  ✅ New records to insert: ${insertRecords.length}`);
  console.log(`  🔄 Skipped duplicates: ${skippedDuplicates}`);
  console.log(`  🛠️  Duplicate date corrections: ${correctedDuplicateDates}`);
  console.log(`  🔄 Pending→Completed updates: ${updatedPendingToCompleted}`);
  console.log(`  🗑️  Canceled records deleted: ${deletedCanceled}`);
  console.log(`  ⚠️  Skipped missing keys: ${skippedMissingKeys}`);
  console.log(`  ⚠️  Skipped no completion date (EntryPDate): ${skippedNoCompletionDate}`);
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

  const resolveAccountLookup = (acctNo: string) => {
    const trimmed = acctNo.trim();
    const match = trimmed.match(/^(.+?)([A-Z]{3})$/);
    if (match) {
      const baseNumber = match[1];
      const currencyCode = match[2];
      const key = `${baseNumber}_${currencyCode}`;
      return bankAccountsMap.get(key) || null;
    }
    return bankAccountsByNumber.get(trimmed) || null;
  };

  const getRate = (dateKey: string, currencyCode: string) => {
    if (currencyCode === 'GEL') return 1;
    const rates = nbgRatesMap.get(dateKey);
    if (!rates) return null;
    const rate = rates[currencyCode as keyof NBGRates];
    return rate && rate > 0 ? Number(rate) : null;
  };

  const resolveAmounts = (
    outCurrency: string,
    inCurrency: string,
    docSrcCcy: string,
    docDstCcy: string,
    docSrcAmt: string,
    docDstAmt: string,
    outRow?: { account_currency_amount?: string | number | null } | null,
    inRow?: { account_currency_amount?: string | number | null } | null
  ) => {
    const srcAmt = Number(docSrcAmt);
    const dstAmt = Number(docDstAmt);
    if (docSrcCcy === outCurrency && docDstCcy === inCurrency) {
      return { amountOut: srcAmt, amountIn: dstAmt };
    }
    if (docSrcCcy === inCurrency && docDstCcy === outCurrency) {
      return { amountOut: dstAmt, amountIn: srcAmt };
    }

    // Some BOG conversion legs carry same-currency DocSrc/DocDst values.
    // Fall back to signed paired ledger rows when metadata mapping is unavailable.
    const outSigned = Number(outRow?.account_currency_amount ?? NaN);
    const inSigned = Number(inRow?.account_currency_amount ?? NaN);
    if (Number.isFinite(outSigned) && Number.isFinite(inSigned)) {
      if (outSigned < 0 && inSigned > 0) {
        return { amountOut: Math.abs(outSigned), amountIn: Math.abs(inSigned) };
      }
      if (outSigned > 0 && inSigned < 0) {
        return { amountOut: Math.abs(inSigned), amountIn: Math.abs(outSigned) };
      }
    }

    return null;
  };

  function hasConversionHint(value: string | null) {
    if (!value) return false;
    return /(კონვერტ|conversion|convert|exchange|fx)/i.test(String(value));
  }

  const inferCounterpartAccount = (
    knownAccount: {
      uuid: string;
      account_number: string;
      currency_uuid: string;
      currency_code: string;
      bank_uuid: string | null;
      insider_uuid: string | null;
    },
    docSrcCcy: string,
    docDstCcy: string
  ) => {
    const src = String(docSrcCcy || '').trim().toUpperCase();
    const dst = String(docDstCcy || '').trim().toUpperCase();
    const knownCcy = String(knownAccount.currency_code || '').trim().toUpperCase();
    let counterpartCcy: string | null = null;

    if (src === knownCcy && dst !== knownCcy) counterpartCcy = dst;
    if (dst === knownCcy && src !== knownCcy) counterpartCcy = src;
    if (!counterpartCcy) return null;

    return bankAccountsMap.get(`${knownAccount.account_number}_${counterpartCcy}`) || null;
  };

  const resolveConversionAccounts = (candidate: {
    senderAcctNo: string;
    benefAcctNo: string;
    docSrcCcy: string | null;
    docDstCcy: string | null;
  }) => {
    const senderAccount = resolveAccountLookup(candidate.senderAcctNo);
    const benefAccount = resolveAccountLookup(candidate.benefAcctNo);

    if (senderAccount && benefAccount && senderAccount.currency_code !== benefAccount.currency_code) {
      return { outAccount: senderAccount, inAccount: benefAccount, fallbackUsed: false };
    }

    const srcCcy = String(candidate.docSrcCcy || '').trim().toUpperCase();
    const dstCcy = String(candidate.docDstCcy || '').trim().toUpperCase();

    if (senderAccount && !benefAccount) {
      const inferredIn = inferCounterpartAccount(senderAccount, srcCcy, dstCcy);
      if (inferredIn && inferredIn.currency_code !== senderAccount.currency_code) {
        return { outAccount: senderAccount, inAccount: inferredIn, fallbackUsed: true };
      }
    }

    if (!senderAccount && benefAccount) {
      const inferredOut = inferCounterpartAccount(benefAccount, srcCcy, dstCcy);
      if (inferredOut && inferredOut.currency_code !== benefAccount.currency_code) {
        return { outAccount: inferredOut, inAccount: benefAccount, fallbackUsed: true };
      }
    }

    return null;
  };

  const resolveConversionAccountsFromRows = async (candidate: {
    dockey: string;
  }) => {
    const matchedRows: Array<{
      account: {
        uuid: string;
        account_number: string;
        currency_uuid: string;
        currency_code: string;
        bank_uuid: string | null;
        insider_uuid: string | null;
      };
      amount: number;
    }> = [];

    for (const tableName of bankAccountTableNames.values()) {
      const { data, error } = await supabase
        .from(tableName)
        .select('bank_account_uuid, account_currency_amount, conversion_id')
        .eq('dockey', candidate.dockey)
        .is('conversion_id', null)
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          continue;
        }
        continue;
      }

      const accountUuid = String((data as any)?.bank_account_uuid || '');
      if (!accountUuid) continue;
      const account = bankAccountsByUuid.get(accountUuid);
      if (!account) continue;

      const amount = Number((data as any)?.account_currency_amount ?? NaN);
      if (!Number.isFinite(amount)) continue;

      matchedRows.push({ account, amount });
    }

    const out = matchedRows.find((item) => item.amount < 0);
    const inRow = matchedRows.find((item) => item.amount > 0 && (!out || item.account.uuid !== out.account.uuid));

    if (!out || !inRow) return null;
    if (out.account.currency_code === inRow.account.currency_code) return null;

    return { outAccount: out.account, inAccount: inRow.account, fallbackUsed: true };
  };

  if (conversionCandidates.size > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('🔁 STEP 2: PROCESSING CONVERSIONS');
    console.log('='.repeat(80) + '\n');

    for (const candidate of conversionCandidates.values()) {
      let resolvedAccounts = resolveConversionAccounts(candidate);
      if (!resolvedAccounts) {
        resolvedAccounts = await resolveConversionAccountsFromRows(candidate);
      }
      if (!resolvedAccounts) continue;

      const { outAccount, inAccount, fallbackUsed } = resolvedAccounts;
      if (outAccount.currency_code === inAccount.currency_code) continue;

      const tableOut = resolveDeconsolidatedTableName(outAccount.account_number, defaultSchemeByCurrency(outAccount.currency_code));
      const tableIn = resolveDeconsolidatedTableName(inAccount.account_number, defaultSchemeByCurrency(inAccount.currency_code));

      const { data: outRow, error: outError } = await supabase
        .from(tableOut)
        .select('*')
        .eq('dockey', candidate.dockey)
        .limit(1)
        .maybeSingle();

      if (outError) {
        if (outError.code === 'PGRST205' || outError.message?.includes('Could not find the table')) {
          console.log(`  ⚠️  Skipping conversion DocKey=${candidate.dockey}: table ${tableOut} does not exist`);
        } else {
          console.error(`  ❌ Supabase HTTP error:`, JSON.stringify(outError, null, 2));
        }
        continue;
      }

      const { data: inRow, error: inError } = await supabase
        .from(tableIn)
        .select('*')
        .eq('dockey', candidate.dockey)
        .limit(1)
        .maybeSingle();

      if (inError) {
        if (inError.code === 'PGRST205' || inError.message?.includes('Could not find the table')) {
          console.log(`  ⚠️  Skipping conversion DocKey=${candidate.dockey}: table ${tableIn} does not exist`);
        } else {
          console.error(`  ❌ Supabase HTTP error:`, JSON.stringify(inError, null, 2));
        }
        continue;
      }

      if (!outRow && !inRow) continue;
      if (outRow?.conversion_id || inRow?.conversion_id) continue;

      if (fallbackUsed && (!outRow || !inRow)) {
        console.log(
          `  ℹ️  One-sided conversion fallback DocKey=${candidate.dockey}: outRow=${Boolean(outRow)}, inRow=${Boolean(inRow)}`
        );
      }

      const amounts = resolveAmounts(
        outAccount.currency_code,
        inAccount.currency_code,
        candidate.docSrcCcy || '',
        candidate.docDstCcy || '',
        candidate.docSrcAmt || '0',
        candidate.docDstAmt || '0',
        outRow,
        inRow
      );

      if (!amounts) continue;

      const dateKey = candidate.date.toISOString().split('T')[0];
      const rateOut = getRate(dateKey, outAccount.currency_code);
      const rateIn = getRate(dateKey, inAccount.currency_code);
      let fee: number | null = null;

      if (rateOut !== null && rateIn !== null) {
        if (outAccount.currency_code === 'GEL') {
          fee = amounts.amountOut - amounts.amountIn * rateIn;
        } else {
          fee = (amounts.amountOut * rateOut - amounts.amountIn * rateIn) / rateOut;
        }
      }

      const { data: existingConversion } = await supabase
        .from('conversion')
        .select('id, uuid')
        .eq('key_value', candidate.dockey)
        .eq('account_out_uuid', outAccount.uuid)
        .eq('account_in_uuid', inAccount.uuid)
        .maybeSingle();

      let conversionUuid = existingConversion?.uuid as string | undefined;
      let conversionId = existingConversion?.id as number | undefined;

      if (!conversionUuid) {
        const insiderUuid = outAccount.insider_uuid ?? inAccount.insider_uuid;
        if (!insiderUuid) {
          console.warn(`⚠️ Skipping conversion DocKey=${candidate.dockey}: insider_uuid is missing for both bank accounts`);
          continue;
        }

        const { data: insertedConversion, error: conversionError } = await supabase
          .from('conversion')
          .insert({
            date: dateKey,
            key_value: candidate.dockey,
            account_out_uuid: outAccount.uuid,
            account_in_uuid: inAccount.uuid,
            bank_uuid: outAccount.bank_uuid ?? inAccount.bank_uuid ?? bogBankUuid,
            insider_uuid: insiderUuid,
            currency_out_uuid: outAccount.currency_uuid,
            currency_in_uuid: inAccount.currency_uuid,
            amount_out: amounts.amountOut,
            amount_in: amounts.amountIn,
            fee: fee,
          })
          .select('id, uuid')
          .single();

        if (conversionError) {
          console.warn(`⚠️ Failed to insert conversion DocKey=${candidate.dockey}:`, conversionError.message);
          continue;
        }

        conversionUuid = insertedConversion?.uuid;
        conversionId = insertedConversion?.id ?? conversionId;
      }

      if (!conversionUuid) continue;

      const conversionDate = candidate.date
        ? candidate.date.toLocaleDateString('en-GB').split('/').join('.')
        : null;
      const amountOut = amounts.amountOut;
      const amountIn = amounts.amountIn;
      const feeValue = fee ?? 0;
      const feeRounded = Math.round(feeValue * 100) / 100;
      const amountOutBody = -Math.abs(amountOut - feeRounded);
      const feeAmount = -Math.abs(feeRounded);
      const amountInValue = amountIn;
      const commentText = `კონვერტაცია ${amountOut.toFixed(2)} ${outAccount.currency_code} = ${amountIn.toFixed(2)} ${inAccount.currency_code}`;
      const exchangeRate = outRow?.exchange_rate ?? inRow?.exchange_rate ?? null;
      const correctionDate = outRow?.correction_date ?? inRow?.correction_date ?? null;
      const description = outRow?.description ?? inRow?.description ?? null;
      const counteragentAccountNumber = inAccount.account_number && inAccount.currency_code
        ? `${inAccount.account_number}${inAccount.currency_code}`
        : inAccount.account_number ?? null;
      const batchId = conversionId ? `CONV_${conversionId}` : `CONV_${conversionUuid}`;

      const conversionEntriesPayload = [
        {
          conversion_id: conversionId ?? null,
          conversion_uuid: conversionUuid,
          entry_type: 'OUT',
          bank_account_uuid: outAccount.uuid,
          raw_record_uuid: outRow?.uuid ?? null,
          dockey: candidate.dockey,
          entriesid: outRow?.entriesid ?? null,
          transaction_date: conversionDate,
          correction_date: correctionDate,
          exchange_rate: exchangeRate,
          description,
          comment: commentText,
          counteragent_uuid: outRow?.counteragent_uuid ?? null,
          counteragent_account_number: counteragentAccountNumber,
          project_uuid: outRow?.project_uuid ?? null,
          financial_code_uuid: outRow?.financial_code_uuid ?? null,
          account_currency_uuid: outRow?.account_currency_uuid ?? outAccount.currency_uuid,
          account_currency_amount: amountOutBody,
          nominal_currency_uuid: outRow?.nominal_currency_uuid ?? outAccount.currency_uuid,
          nominal_amount: amountOutBody,
          payment_id: outRow?.payment_id ?? null,
          processing_case: outRow?.processing_case ?? null,
          parsing_lock: true,
          applied_rule_id: outRow?.applied_rule_id ?? null,
          batch_id: batchId,
          account_number: outAccount.account_number ?? null,
          bank_name: outRow?.bank_name ?? null,
          account_currency_code: outAccount.currency_code ?? null,
          nominal_currency_code: outAccount.currency_code ?? null,
          usd_gel_rate: outRow?.usd_gel_rate ?? null,
          counteragent_name: outRow?.counteragent_name ?? null,
          financial_code: outRow?.financial_code ?? null,
          project_index: outRow?.project_index ?? null,
          insider_uuid: outAccount.insider_uuid ?? inAccount.insider_uuid ?? null,
        },
        {
          conversion_id: conversionId ?? null,
          conversion_uuid: conversionUuid,
          entry_type: 'FEE',
          bank_account_uuid: outAccount.uuid,
          raw_record_uuid: outRow?.uuid ?? null,
          dockey: candidate.dockey,
          entriesid: outRow?.entriesid ?? null,
          transaction_date: conversionDate,
          correction_date: correctionDate,
          exchange_rate: exchangeRate,
          description,
          comment: commentText,
          counteragent_uuid: outRow?.counteragent_uuid ?? null,
          counteragent_account_number: counteragentAccountNumber,
          project_uuid: outRow?.project_uuid ?? null,
          financial_code_uuid: outRow?.financial_code_uuid ?? null,
          account_currency_uuid: outRow?.account_currency_uuid ?? outAccount.currency_uuid,
          account_currency_amount: feeAmount,
          nominal_currency_uuid: outRow?.nominal_currency_uuid ?? outAccount.currency_uuid,
          nominal_amount: feeAmount,
          payment_id: outRow?.payment_id ?? null,
          processing_case: outRow?.processing_case ?? null,
          parsing_lock: true,
          applied_rule_id: outRow?.applied_rule_id ?? null,
          batch_id: batchId,
          account_number: outAccount.account_number ?? null,
          bank_name: outRow?.bank_name ?? null,
          account_currency_code: outAccount.currency_code ?? null,
          nominal_currency_code: outAccount.currency_code ?? null,
          usd_gel_rate: outRow?.usd_gel_rate ?? null,
          counteragent_name: outRow?.counteragent_name ?? null,
          financial_code: outRow?.financial_code ?? null,
          project_index: outRow?.project_index ?? null,
          insider_uuid: outAccount.insider_uuid ?? inAccount.insider_uuid ?? null,
        },
        {
          conversion_id: conversionId ?? null,
          conversion_uuid: conversionUuid,
          entry_type: 'IN',
          bank_account_uuid: inAccount.uuid,
          raw_record_uuid: inRow?.uuid ?? null,
          dockey: candidate.dockey,
          entriesid: inRow?.entriesid ?? null,
          transaction_date: conversionDate,
          correction_date: correctionDate,
          exchange_rate: exchangeRate,
          description,
          comment: commentText,
          counteragent_uuid: inRow?.counteragent_uuid ?? null,
          counteragent_account_number: counteragentAccountNumber,
          project_uuid: inRow?.project_uuid ?? null,
          financial_code_uuid: inRow?.financial_code_uuid ?? null,
          account_currency_uuid: inRow?.account_currency_uuid ?? inAccount.currency_uuid,
          account_currency_amount: amountInValue,
          nominal_currency_uuid: inRow?.nominal_currency_uuid ?? inAccount.currency_uuid,
          nominal_amount: amountInValue,
          payment_id: inRow?.payment_id ?? null,
          processing_case: inRow?.processing_case ?? null,
          parsing_lock: true,
          applied_rule_id: inRow?.applied_rule_id ?? null,
          batch_id: batchId,
          account_number: inAccount.account_number ?? null,
          bank_name: inRow?.bank_name ?? outRow?.bank_name ?? null,
          account_currency_code: inAccount.currency_code ?? null,
          nominal_currency_code: inAccount.currency_code ?? null,
          usd_gel_rate: inRow?.usd_gel_rate ?? null,
          counteragent_name: inRow?.counteragent_name ?? null,
          financial_code: inRow?.financial_code ?? null,
          project_index: inRow?.project_index ?? null,
          insider_uuid: inAccount.insider_uuid ?? outAccount.insider_uuid ?? null,
        },
      ];

      const { error: conversionEntriesError } = await supabase
        .from('conversion_entries')
        .upsert(conversionEntriesPayload, { onConflict: 'conversion_uuid,entry_type' });

      if (conversionEntriesError) {
        console.warn('⚠️ Failed to upsert conversion entries:', conversionEntriesError.message);
      }

      if (outRow?.uuid) {
        await supabase.from(tableOut).update({ conversion_id: conversionUuid }).eq('uuid', outRow.uuid);
      }
      if (inRow?.uuid) {
        await supabase.from(tableIn).update({ conversion_id: conversionUuid }).eq('uuid', inRow.uuid);
      }
    }
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
  console.log(`  📦 Total new records: ${insertRecords.length}`);
  console.log(`  🔄 Pending→Completed: ${updatedPendingToCompleted}`);
  console.log(`  🗑️  Canceled deleted: ${deletedCanceled}\n`);

  if (missingNbgRateDates.size > 0) {
    console.log(`\n⚠️  WARNING: NBG exchange rates missing for ${missingNbgRateDates.size} date(s)!`);
    console.log('━'.repeat(80));
    console.log('  Nominal amounts for these dates are INCORRECT (set equal to account amount).');
    console.log('  Please update the NBG exchange rates table and re-import or manually fix affected records.');
    const sortedDates = Array.from(missingNbgRateDates).sort();
    for (const d of sortedDates) {
      console.log(`  ❌ Missing rate: ${d}`);
    }
    console.log('━'.repeat(80));
  }

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
