/**
 * Bank XML Import Orchestrator - Comprehensive Three-Phase Processing
 * TypeScript equivalent of import_bank_xml_data.py for Vercel
 * 
 * This script consolidates all XML import and processing logic:
 * 1. Identifies bank account and parsing scheme
 * 2. Parses XML and inserts raw data
 * 3. Three-phase processing: Parsing Rules → Counteragent → Payment ID
 * 
 * Implements three-phase processing hierarchy (by PRIORITY):
 * PHASE 1: Parsing Rules (HIGHEST PRIORITY - IMMUTABLE if matched)
 * PHASE 2: Counteragent identification by INN (Second priority)
 * PHASE 3: Payment ID matching (LOWEST PRIORITY - Neglected if conflicts)
 */

import { parseStringPromise } from 'xml2js';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
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
  BOGDetailRecord,
  CounteragentData,
  ParsingRule,
  PaymentData,
  NBGRates,
  ProcessingResult,
  ProcessingStats,
  ConsolidatedRecord,
  RawUpdate,
  AccountInfo,
} from './types';

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Parse BOG date format (YYYY-MM-DD) to Date object
 */
function parseBOGDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const cleaned = dateStr.trim();
    // Support both YYYY-MM-DD and YYYYMMDD formats
    if (cleaned.length === 10) {
      return new Date(cleaned);
    } else if (cleaned.length === 8) {
      const year = cleaned.substring(0, 4);
      const month = cleaned.substring(4, 6);
      const day = cleaned.substring(6, 8);
      return new Date(`${year}-${month}-${day}`);
    }
    return null;
  } catch {
    return null;
  }
}

function parseTBCDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const cleaned = dateStr.trim();
    const match = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return new Date(`${year}-${month}-${day}`);
  } catch {
    return null;
  }
}

function formatTBCDate(dateStr: string | undefined): string | null {
  const parsed = parseTBCDate(dateStr);
  if (!parsed) return null;
  return parsed.toISOString().split('T')[0];
}

/**
 * Calculate nominal amount using NBG exchange rates
 * Matches Python implementation exactly
 */
function calculateNominalAmount(
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

  // Case 1: GEL → Foreign (divide by rate)
  if (accountCurrencyCode === 'GEL' && nominalCurrencyCode in rates) {
    const rate = rates[nominalCurrencyCode as keyof NBGRates];
    if (rate && rate > 0) {
      return accountCurrencyAmount / rate;
    }
  }

  // Case 2: Foreign → GEL (multiply by rate)
  if (accountCurrencyCode in rates && nominalCurrencyCode === 'GEL') {
    const rate = rates[accountCurrencyCode as keyof NBGRates];
    if (rate && rate > 0) {
      return accountCurrencyAmount * rate;
    }
  }

  // Case 3: Foreign → Foreign (through GEL)
  if (accountCurrencyCode in rates && nominalCurrencyCode in rates) {
    const accountRate = rates[accountCurrencyCode as keyof NBGRates];
    const nominalRate = rates[nominalCurrencyCode as keyof NBGRates];
    if (accountRate && nominalRate && accountRate > 0 && nominalRate > 0) {
      return (accountCurrencyAmount * accountRate) / nominalRate;
    }
  }

  return accountCurrencyAmount;
}

/**
 * Compute case description from flags
 */
function computeCaseDescription(
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

  // Phase 2: Counteragent by INN (mutually exclusive)
  if (case1) cases.push('Case1 - counteragent identified by INN');
  else if (case2) cases.push('Case2 - no INN in raw data');
  else if (case3) cases.push('Case3 - INN exists but no counteragent match');

  // Phase 1: Parsing Rules (HIGHEST PRIORITY)
  if (case6) {
    const ruleText = appliedRuleId
      ? `Case6 - parsing rule applied (ID: ${appliedRuleId})`
      : 'Case6 - parsing rule applied';
    cases.push(ruleText);
  } else if (case7) {
    cases.push('Case7 - parsing rule kept (INN conflict)');
  }

  // Phase 3: Payment ID
  if (case4) cases.push('Case4 - payment ID matched');
  else if (case5) cases.push('Case5 - payment ID conflict (Phase 1/2 kept)');

  if (case8) cases.push('Case8 - rule dominance (overrides payment)');

  return cases.length > 0 ? cases.join(' ') : 'No case matched';
}

/**
 * Process single record with three-phase hierarchy
 * Common logic shared between import and backparse
 */
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

function extractTBCPaymentId(row: Record<string, any>): string | null {
  const raw = row.additionaldescription ?? row.additionalinformation ?? '';
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, '_').toLowerCase();
}

function processSingleRecord(
  row: any,
  counteragentsMap: Map<string, CounteragentData>,
  parsingRules: ParsingRule[],
  paymentsMap: Map<string, PaymentData>,
  salaryBaseMap: Map<string, PaymentData>,
  salaryLatestMap: Map<string, { month: number; year: number; data: PaymentData }>,
  duplicatePaymentMap: Map<string, string>,
  idx: number,
  stats: ProcessingStats,
  missingCounteragents: Map<string, { inn: string; count: number; name: string }>,
  paymentIdExtractor?: (row: Record<string, any>) => string | null
): ProcessingResult {
  const DocKey = row.dockey;
  const EntriesId = row.entriesid;
  const DocSenderInn = row.docsenderinn;
  const DocBenefInn = row.docbenefinn;
  const DocCorAcct = row.doccorracct;
  const DocSenderAcctNo = row.docsenderacctno;
  const DocBenefAcctNo = row.docbenefacctno;
  const DocProdGroup = row.docprodgroup;
  const DocNomination = row.docnomination;
  const DocInformation = row.docinformation;
  const debit = row.debit;

  // Initialize result
  const result: ProcessingResult = {
    counteragent_uuid: null,
    counteragent_account_number: null,
    counteragent_inn: null,
    project_uuid: null,
    financial_code_uuid: null,
    nominal_currency_uuid: null,
    payment_id: null,
    applied_rule_id: null,
    case1_counteragent_processed: false,
    case1_counteragent_found: false,
    case3_counteragent_missing: false,
    case4_payment_id_matched: false,
    case5_payment_id_conflict: false,
    case6_parsing_rule_applied: false,
    case7_parsing_rule_conflict: false,
  };

  // Extract counteragent account and INN
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

  // =============================
  // PHASE 1: Parsing Rules (HIGHEST PRIORITY - IMMUTABLE)
  // =============================

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
    }

    // Parsing rules set counteragent (HIGHEST PRIORITY - IMMUTABLE)
    let ruleCounteragent = matchedRule.counteragent_uuid;
    if (!ruleCounteragent && rulePaymentData) {
      ruleCounteragent = rulePaymentData.counteragent_uuid;
    }

    if (ruleCounteragent && !result.counteragent_uuid) {
      result.counteragent_uuid = ruleCounteragent;
    }

    // Apply rule parameters (IMMUTABLE - highest priority)
    if (matchedRule.financial_code_uuid && !result.financial_code_uuid) {
      result.financial_code_uuid = matchedRule.financial_code_uuid;
    }

    if (matchedRule.nominal_currency_uuid && !result.nominal_currency_uuid) {
      result.nominal_currency_uuid = matchedRule.nominal_currency_uuid;
    }

    stats.case6_parsing_rule_match++;

    if (idx <= 3) {
      console.log(
        `  📋 Record ${idx}: Parsing rule matched (ID: ${matchedRule.id}, counteragent: ${ruleCounteragent})`
      );
    }
  }

  // =============================
  // PHASE 2: Counteragent by INN (Second Priority)
  // =============================

  if (!result.counteragent_uuid && counteragentInn) {
    const counteragentData = counteragentsMap.get(counteragentInn);
    if (counteragentData) {
      result.counteragent_uuid = counteragentData.uuid;
      result.case1_counteragent_processed = true;
      result.case1_counteragent_found = true;
      stats.case1_counteragent_processed++;

      if (idx <= 3) {
        console.log(`  🔍 Record ${idx}: Counteragent found by INN ${counteragentInn}`);
      }
    } else {
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
    // Phase 1 already set counteragent, check for conflict
    const counteragentData = counteragentsMap.get(counteragentInn);
    if (counteragentData && counteragentData.uuid !== result.counteragent_uuid) {
      result.case7_parsing_rule_conflict = true;
      stats.case7_parsing_rule_counteragent_mismatch++;

      if (idx <= 3) {
        console.log(
          `  ⚠️  Record ${idx}: Parsing rule vs INN conflict (kept parsing rule counteragent)`
        );
      }
    }
  }

  // =============================
  // PHASE 3: Payment ID (LOWEST PRIORITY - Neglected if conflicts)
  // =============================

  const extractPaymentIdFromRow =
    paymentIdExtractor || ((sourceRow: Record<string, any>) => extractPaymentID(sourceRow.docinformation));
  const extractedPaymentId = extractPaymentIdFromRow(row);
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

        // If suffix invalid or missing, replace with next month of latest salary accruals
        if (!isValidSalaryPeriodSuffix(mappedPaymentLower) && salaryLatestMap.has(baseKey)) {
          const latest = salaryLatestMap.get(baseKey)!;
          const next = nextMonth({ month: latest.month, year: latest.year });
          const baseOriginal = mappedPaymentId.trim().slice(0, 20);
          resolvedPaymentId = formatSalaryPeriod(baseOriginal, next);
        }
      }
    }

    if (paymentData) {
      // Check for conflicts with Phase 1/2
      if (
        result.counteragent_uuid &&
        paymentData.counteragent_uuid &&
        paymentData.counteragent_uuid !== result.counteragent_uuid
      ) {
        result.case5_payment_id_conflict = true;
        stats.case5_payment_id_counteragent_mismatch++;

        if (idx <= 3) {
          console.log(
            `  ⚠️  Record ${idx}: Payment ID conflict - kept Phase 1/2 counteragent`
          );
        }
      } else {
        // No conflict, apply payment data
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
      }

      stats.case4_payment_id_match++;

      if (idx <= 3) {
        console.log(`  💳 Record ${idx}: Payment ID matched: ${resolvedPaymentId}`);
      }
    }
  }

  return result;
}

/**
 * Identify BOG GEL account from XML header
 */
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
    const accountNumber = accountFull;

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

async function identifyTBCGELAccount(xmlContent: string): Promise<AccountInfo | null> {
  try {
    const parsed = await parseStringPromise(xmlContent, {
      tagNameProcessors: [(name) => name.replace(/^[^:]+:/, '')],
    });

    let root = parsed.AccountStatement || parsed;

    if (root && typeof root === 'object' && !root.Head && !root.Record && !root.Records) {
      const keys = Object.keys(root);
      if (keys.length === 1) {
        root = root[keys[0]];
      }
    }

    const head = root?.Head?.[0];
    if (!head) {
      throw new Error('Invalid TBC GEL XML format - missing Head');
    }

    const accountNumber = String(head.AccountNo?.[0] || '').trim();
    const currencyCode = String(head.Currency?.[0] || '').trim();

    if (!accountNumber || !currencyCode) {
      throw new Error('Invalid account number or currency in XML');
    }

    return {
      account_number: accountNumber,
      currency_code: currencyCode,
      xml_root: root,
    };
  } catch (error: any) {
    console.log('⚠️ Could not parse as TBC GEL format:', error.message);
    return null;
  }
}

/**
 * Main function to process BOG GEL XML import
 * Called when uploading XML files via the UI
 */
export async function processBOGGEL(
  xmlContent: string,
  accountUuid: string,
  accountNumber: string,
  currencyCode: string,
  rawTableName: string,
  importBatchId: string
): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 BOG GEL PROCESSING - Three-Phase Hierarchy');
  console.log('='.repeat(80) + '\n');

  const supabase = getSupabaseClient();

  // Get account details
  const { data: accountData, error: accountError } = await supabase
    .from('bank_accounts')
    .select('uuid, currency_uuid')
    .eq('uuid', accountUuid)
    .single();

  if (accountError || !accountData) {
    throw new Error(`Account UUID not found: ${accountUuid}`);
  }

  const bankAccountUuid = accountData.uuid;
  const accountCurrencyUuid = accountData.currency_uuid;

  console.log(`📊 Bank Account UUID: ${bankAccountUuid}`);
  console.log(`💱 Account Currency UUID: ${accountCurrencyUuid}\n`);

  // =============================
  // STEP 1: Parse XML and Insert Raw Data
  // =============================
  console.log('📄 STEP 1: Parsing XML and inserting raw data...');

  const accountInfo = await identifyBOGGELAccount(xmlContent);
  if (!accountInfo) {
    throw new Error('Failed to parse XML');
  }

  // DETAILS (plural) contains multiple DETAIL elements
  const detailsContainer = accountInfo.xml_root.DETAILS?.[0] || accountInfo.xml_root;
  const details = detailsContainer.DETAIL || [];
  console.log(`📦 Found ${details.length} transactions in XML\n`);

  const rawRecordsToInsert: any[] = [];
  const recordUuids: string[] = [];
  let skippedRawDuplicates = 0;
  let skippedMissingKeys = 0;

  for (const detail of details) {
    const getText = (tagName: string) => detail[tagName]?.[0] || null;

    const DocKey = getText('DocKey');
    const EntriesId = getText('EntriesId');

    if (!DocKey || !EntriesId) {
      skippedMissingKeys++;
      continue;
    }

    // Check for duplicates
    const { data: existing } = await supabase
      .from(rawTableName)
      .select('uuid')
      .eq('dockey', DocKey)
      .eq('entriesid', EntriesId)
      .single();

    if (existing) {
      skippedRawDuplicates++;
      continue;
    }

    // Generate UUID
    const recordUuidStr = `${DocKey}_${EntriesId}`;
    const recordUuid = uuidv5(recordUuidStr, DNS_NAMESPACE);
    recordUuids.push(recordUuid);

    rawRecordsToInsert.push({
      uuid: recordUuid,
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
      entrydbamt: getText('EntryDbAmt'),
      entrydbamtbase: getText('EntryDbAmtBase'),
      entrycramt: getText('EntryCrAmt'),
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
      counteragent_processed: false,
      parsing_rule_processed: false,
      payment_id_processed: false,
      is_processed: false,
    });
  }

  console.log(`📊 Raw Data Import Results:`);
  console.log(`  ✅ New records to insert: ${rawRecordsToInsert.length}`);
  console.log(`  🔄 Skipped duplicates: ${skippedRawDuplicates}`);
  console.log(`  ⚠️  Skipped missing keys: ${skippedMissingKeys}\n`);

  // Insert raw records
  if (rawRecordsToInsert.length > 0) {
    console.log(`💾 Inserting ${rawRecordsToInsert.length} raw records...`);

    const { error: insertError } = await supabase.from(rawTableName).insert(rawRecordsToInsert);

    if (insertError) throw insertError;

    console.log(`✅ Successfully inserted ${rawRecordsToInsert.length} raw records!\n`);
  } else {
    console.log('⚠️ No new records to insert\n');
  }

  // =============================
  // STEP 2: Load Dictionaries
  // =============================
  console.log('\n' + '='.repeat(80));
  console.log('🔄 STEP 2: LOADING DICTIONARIES');
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

  // =============================
  // STEP 3: Three-Phase Processing
  // =============================
  console.log('\n' + '='.repeat(80));
  console.log('🔄 STEP 3: THREE-PHASE PROCESSING WITH HIERARCHY');
  console.log('='.repeat(80) + '\n');

  const rawRecords: any[] = [];
  const batchSize = 1000;
  for (let i = 0; i < recordUuids.length; i += batchSize) {
    const batch = recordUuids.slice(i, i + batchSize);
    const { data: batchData, error: fetchError } = await supabase
      .from(rawTableName)
      .select(
        'uuid, dockey, entriesid, docrecdate, docvaluedate, entrycramt, entrydbamt, docsenderinn, docbenefinn, docsenderacctno, docbenefacctno, doccoracct, docnomination, docinformation, docprodgroup, ccyrate'
      )
      .in('uuid', batch)
      .order('docvaluedate', { ascending: false });

    if (fetchError) throw fetchError;
    rawRecords.push(...(batchData || []));
  }

  const totalRecords = rawRecords.length || 0;
  console.log(`📦 Processing ${totalRecords} records...\n`);

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
  const consolidatedRecords: ConsolidatedRecord[] = [];
  const rawUpdates: RawUpdate[] = [];

  for (let idx = 0; idx < totalRecords; idx++) {
    const rawRecord = rawRecords[idx];

    const credit = rawRecord.entrycramt ? parseFloat(rawRecord.entrycramt) : 0;
    const debit = rawRecord.entrydbamt ? parseFloat(rawRecord.entrydbamt) : 0;
    const accountCurrencyAmount = credit - debit;

    const transactionDate = parseBOGDate(rawRecord.docvaluedate);
    if (!transactionDate) continue;

    const row = {
      uuid: rawRecord.uuid,
      dockey: rawRecord.dockey,
      entriesid: rawRecord.entriesid,
      docsenderinn: rawRecord.docsenderinn,
      docbenefinn: rawRecord.docbenefinn,
      doccorracct: rawRecord.doccoracct,
      docsenderacctno: rawRecord.docsenderacctno,
      docbenefacctno: rawRecord.docbenefacctno,
      docprodgroup: rawRecord.docprodgroup,
      docnomination: rawRecord.docnomination,
      docinformation: rawRecord.docinformation,
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

    const consolidatedUuid = uuidv4();
    consolidatedRecords.push({
      uuid: consolidatedUuid,
      bank_account_uuid: bankAccountUuid,
      raw_record_uuid: rawRecord.uuid,
      transaction_date: transactionDate,
      description: rawRecord.docnomination || '',
      counteragent_uuid: result.counteragent_uuid,
      counteragent_account_number: result.counteragent_account_number,
      project_uuid: result.project_uuid,
      financial_code_uuid: result.financial_code_uuid,
      payment_id: result.payment_id,
      account_currency_uuid: accountCurrencyUuid,
      account_currency_amount: accountCurrencyAmount,
      nominal_currency_uuid: nominalCurrencyUuid,
      nominal_amount: nominalAmount,
      processing_case: caseDescription,
      applied_rule_id: result.applied_rule_id,
    });




    rawUpdates.push({
      uuid: rawRecord.uuid,
      counteragent_processed: result.case1_counteragent_processed,
      counteragent_found: result.case1_counteragent_found,
      counteragent_missing: result.case3_counteragent_missing,
      payment_id_matched: result.case4_payment_id_matched,
      payment_id_conflict: result.case5_payment_id_conflict,
      parsing_rule_applied: result.case6_parsing_rule_applied,
      parsing_rule_conflict: result.case7_parsing_rule_conflict,
      counteragent_inn: result.counteragent_inn,
      applied_rule_id: result.applied_rule_id,
      processing_case: caseDescription,
    });

    if ((idx + 1) % 1000 === 0 || idx + 1 === totalRecords) {
      console.log(`  ✅ Processed ${idx + 1}/${totalRecords} records...`);
    }
  }

  // =============================
  // STEP 4: Insert Consolidated Records
  // =============================
  console.log('\n' + '='.repeat(80));
  console.log(`📊 STEP 4: INSERTING ${consolidatedRecords.length} CONSOLIDATED RECORDS`);
  console.log('='.repeat(80) + '\n');

  if (consolidatedRecords.length > 0) {
    const { error: consolidatedError } = await supabase
      .from('consolidated_bank_accounts')
      .upsert(consolidatedRecords, {
        onConflict: 'uuid',
      });

    if (consolidatedError) throw consolidatedError;
    console.log(`✅ Inserted ${consolidatedRecords.length} consolidated records\n`);
  }

  // =============================
  // STEP 5: Update Raw Table Flags
  // =============================
  console.log('\n' + '='.repeat(80));
  console.log(`📊 STEP 5: UPDATING ${rawUpdates.length} RAW TABLE FLAGS`);
  console.log('='.repeat(80) + '\n');

  // Batch update using upsert (much faster than individual updates)
  console.log(`  🚀 Starting optimized batch update...`);
  
  if (rawUpdates.length > 0) {
    // Prepare records for upsert
    const updateRecords = rawUpdates.map(update => ({
      uuid: update.uuid,
      counteragent_processed: update.counteragent_processed,
      counteragent_found: update.counteragent_found,
      counteragent_missing: update.counteragent_missing,
      payment_id_matched: update.payment_id_matched,
      payment_id_conflict: update.payment_id_conflict,
      parsing_rule_applied: update.parsing_rule_applied,
      parsing_rule_conflict: update.parsing_rule_conflict,
      parsing_rule_processed: true,
      payment_id_processed: true,
      counteragent_inn: update.counteragent_inn,
      applied_rule_id: update.applied_rule_id,
      processing_case: update.processing_case,
      is_processed: true,
      updated_at: new Date().toISOString(),
    }));

    // Use upsert for bulk update (Supabase optimizes this)
    const batchSize = 1000;
    for (let i = 0; i < updateRecords.length; i += batchSize) {
      const batch = updateRecords.slice(i, i + batchSize);
      const { error: updateError } = await supabase
        .from(rawTableName)
        .upsert(batch, {
          onConflict: 'uuid',
          ignoreDuplicates: false,
        });

      if (updateError) throw updateError;
      console.log(`  ✅ Updated ${Math.min(i + batchSize, updateRecords.length)}/${updateRecords.length} records...`);
    }
  }

  // =============================
  // FINAL SUMMARY
  // =============================
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
  console.log(`  📦 Total records: ${totalRecords}\n`);

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
  console.log('✅ Import completed successfully!');
  console.log('='.repeat(80) + '\n');
}

export async function processTBCGEL(
  xmlContent: string,
  accountUuid: string,
  accountNumber: string,
  currencyCode: string,
  rawTableName: string,
  importBatchId: string
): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 TBC GEL PROCESSING - Three-Phase Hierarchy');
  console.log('='.repeat(80) + '\n');

  const supabase = getSupabaseClient();

  const { data: accountData, error: accountError } = await supabase
    .from('bank_accounts')
    .select('uuid, currency_uuid')
    .eq('uuid', accountUuid)
    .single();

  if (accountError || !accountData) {
    throw new Error(`Account UUID not found: ${accountUuid}`);
  }

  const bankAccountUuid = accountData.uuid;
  const accountCurrencyUuid = accountData.currency_uuid;
  const deconsolidatedTableName = `${accountNumber}_TBC_GEL`;

  console.log(`📊 Bank Account UUID: ${bankAccountUuid}`);
  console.log(`💱 Account Currency UUID: ${accountCurrencyUuid}\n`);

  console.log('📄 STEP 1: Parsing XML and inserting raw data...');

  const accountInfo = await identifyTBCGELAccount(xmlContent);
  if (!accountInfo) {
    throw new Error('Failed to parse XML');
  }

  const detailsContainer = accountInfo.xml_root.Records?.[0] || accountInfo.xml_root;
  const records = detailsContainer.Record || [];
  console.log(`📦 Found ${records.length} transactions in XML\n`);

  const rawRecordsToInsert: any[] = [];
  const recordUuids: string[] = [];
  let skippedRawDuplicates = 0;
  let skippedMissingKeys = 0;

  for (const record of records) {
    const getText = (tagName: string) => record[tagName]?.[0] || null;

    const documentNumber = getText('DocumentNumber');
    const transactionId = getText('TransactionId');

    if (!documentNumber || !transactionId) {
      skippedMissingKeys++;
      continue;
    }

    const { data: existing } = await supabase
      .from(rawTableName)
      .select('uuid')
      .eq('transaction_id', transactionId)
      .eq('document_number', documentNumber)
      .single();

    if (existing) {
      skippedRawDuplicates++;
      continue;
    }

    const recordUuidStr = `${documentNumber}_${transactionId}`;
    const recordUuid = uuidv5(recordUuidStr, DNS_NAMESPACE);
    recordUuids.push(recordUuid);

    const paidInValue = parseFloat(getText('PaidIn') || '0');
    const paidOutValue = parseFloat(getText('PaidOut') || '0');
    const isIncoming = paidInValue > 0 && paidOutValue === 0;

    const partnerTaxCode = getText('PartnerTaxCode');
    const partnerAccountNumber = getText('PartnerAccountNumber');
    const description = getText('Description');
    const additionalInformation = getText('AdditionalInformation');
    const additionalDescription = getText('AdditionalDescription');
    const combinedDescription = [description, additionalInformation].filter(Boolean).join(' | ');
    const operationCode = getText('OperationCode');
    const docDate = formatTBCDate(getText('DocumentDate')) || formatTBCDate(getText('Date'));
    const valueDate = formatTBCDate(getText('Date')) || docDate;

    rawRecordsToInsert.push({
      uuid: recordUuid,
      date: getText('Date'),
      paid_in: paidInValue ? String(paidInValue) : '0',
      paid_out: paidOutValue ? String(paidOutValue) : '0',
      balance: getText('Balance'),
      description: description,
      additional_information: additionalInformation,
      additional_description: additionalDescription,
      transaction_type: getText('TransactionType'),
      document_date: getText('DocumentDate'),
      document_number: documentNumber,
      partner_account_number: partnerAccountNumber,
      partner_name: getText('PartnerName'),
      partner_bank_code: getText('PartnerBankCode'),
      partner_bank_name: getText('PartnerBankName'),
      operation_code: operationCode,
      partner_tax_code: partnerTaxCode,
      taxpayer_code: getText('TaxpayerCode'),
      taxpayer_name: getText('TaxpayerName'),
      transaction_id: transactionId,
      import_batch_id: importBatchId,
      counteragent_processed: false,
      parsing_rule_processed: false,
      payment_id_processed: false,
      is_processed: false,
    });
  }

  console.log(`📊 Raw Data Import Results:`);
  console.log(`  ✅ New records to insert: ${rawRecordsToInsert.length}`);
  console.log(`  🔄 Skipped duplicates: ${skippedRawDuplicates}`);
  console.log(`  ⚠️  Skipped missing keys: ${skippedMissingKeys}\n`);

  if (rawRecordsToInsert.length > 0) {
    console.log(`💾 Inserting ${rawRecordsToInsert.length} raw records...`);

    const { error: insertError } = await supabase.from(rawTableName).insert(rawRecordsToInsert);

    if (insertError) throw insertError;

    console.log(`✅ Successfully inserted ${rawRecordsToInsert.length} raw records!\n`);
  } else {
    console.log('⚠️ No new records to insert\n');
  }

  console.log('\n' + '='.repeat(80));
  console.log('🔄 STEP 2: LOADING DICTIONARIES');
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

  console.log('\n' + '='.repeat(80));
  console.log('🔄 STEP 3: THREE-PHASE PROCESSING WITH HIERARCHY');
  console.log('='.repeat(80) + '\n');

  const rawRecords: any[] = [];
  const batchSize = 1000;
  for (let i = 0; i < recordUuids.length; i += batchSize) {
    const batch = recordUuids.slice(i, i + batchSize);
    const { data: batchData, error: fetchError } = await supabase
      .from(rawTableName)
      .select(
        'uuid, date, paid_in, paid_out, description, additional_information, additional_description, transaction_type, document_date, document_number, partner_account_number, partner_name, partner_bank_code, partner_bank_name, operation_code, partner_tax_code, taxpayer_code, taxpayer_name, transaction_id'
      )
      .in('uuid', batch)
      .order('date', { ascending: false });

    if (fetchError) throw fetchError;
    rawRecords.push(...(batchData || []));
  }

  const totalRecords = rawRecords.length || 0;
  console.log(`📦 Processing ${totalRecords} records...\n`);

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
  const rawUpdates: RawUpdate[] = [];
  const deconsolidatedRecords: any[] = [];
  const importDateStr = new Date().toISOString();

  for (let idx = 0; idx < totalRecords; idx++) {
    const rawRecord = rawRecords[idx];

    const credit = rawRecord.paid_in ? parseFloat(rawRecord.paid_in) : 0;
    const debit = rawRecord.paid_out ? parseFloat(rawRecord.paid_out) : 0;
    const accountCurrencyAmount = credit - debit;

    const transactionDate = parseTBCDate(rawRecord.date);
    if (!transactionDate) continue;

    const combinedDescription = [rawRecord.description, rawRecord.additional_information]
      .filter(Boolean)
      .join(' | ');
    const isIncoming = debit === 0 && credit > 0;

    const row = {
      uuid: rawRecord.uuid,
      dockey: rawRecord.transaction_id,
      entriesid: rawRecord.document_number,
      docsenderinn: isIncoming ? rawRecord.partner_tax_code : null,
      docbenefinn: isIncoming ? null : rawRecord.partner_tax_code,
      doccorracct: rawRecord.partner_account_number,
      docsenderacctno: isIncoming ? rawRecord.partner_account_number : null,
      docbenefacctno: isIncoming ? null : rawRecord.partner_account_number,
      docprodgroup: rawRecord.operation_code,
      docnomination: combinedDescription,
      docinformation: rawRecord.additional_description || rawRecord.additional_information,
      additionaldescription: rawRecord.additional_description,
      additionalinformation: rawRecord.additional_information,
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
      missingCounteragents,
      extractTBCPaymentId
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

    deconsolidatedRecords.push({
      uuid: rawRecord.uuid,
      import_date: importDateStr,
      created_at: importDateStr,
      updated_at: importDateStr,
      docnomination: combinedDescription,
      docinformation: rawRecord.additional_description || rawRecord.additional_information,
      dockey: rawRecord.transaction_id,
      docrecdate: rawRecord.document_date || rawRecord.date,
      docprodgroup: rawRecord.operation_code,
      docvaluedate: rawRecord.date,
      docsenderinn: isIncoming ? rawRecord.partner_tax_code : null,
      docbenefinn: isIncoming ? null : rawRecord.partner_tax_code,
      docsenderacctno: isIncoming ? rawRecord.partner_account_number : null,
      docbenefacctno: isIncoming ? null : rawRecord.partner_account_number,
      doccoracct: rawRecord.partner_account_number,
      entriesid: rawRecord.document_number,
      entrydbamt: rawRecord.paid_out,
      entrycramt: rawRecord.paid_in,
      import_batch_id: importBatchId,
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
      counteragent_found: result.case1_counteragent_found,
      counteragent_missing: result.case3_counteragent_missing,
      payment_id_matched: result.case4_payment_id_matched,
      payment_id_conflict: result.case5_payment_id_conflict,
      parsing_rule_applied: result.case6_parsing_rule_applied,
      parsing_rule_conflict: result.case7_parsing_rule_conflict,
      bank_account_uuid: bankAccountUuid,
      raw_record_uuid: rawRecord.uuid,
      transaction_date: transactionDate.toISOString().split('T')[0],
      description: combinedDescription,
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
      exchange_rate: null,
      parsing_lock: false,
    });

    rawUpdates.push({
      uuid: rawRecord.uuid,
      counteragent_processed: result.case1_counteragent_processed,
      counteragent_found: result.case1_counteragent_found,
      counteragent_missing: result.case3_counteragent_missing,
      payment_id_matched: result.case4_payment_id_matched,
      payment_id_conflict: result.case5_payment_id_conflict,
      parsing_rule_applied: result.case6_parsing_rule_applied,
      parsing_rule_conflict: result.case7_parsing_rule_conflict,
      counteragent_inn: result.counteragent_inn,
      applied_rule_id: result.applied_rule_id,
      processing_case: caseDescription,
    });

    if ((idx + 1) % 1000 === 0 || idx + 1 === totalRecords) {
      console.log(`  ✅ Processed ${idx + 1}/${totalRecords} records...`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📊 STEP 4: INSERTING ${deconsolidatedRecords.length} DECONSOLIDATED RECORDS`);
  console.log('='.repeat(80) + '\n');

  if (deconsolidatedRecords.length > 0) {
    const batchSize = 1000;
    for (let i = 0; i < deconsolidatedRecords.length; i += batchSize) {
      const batch = deconsolidatedRecords.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from(deconsolidatedTableName)
        .insert(batch);

      if (insertError) throw insertError;
      console.log(`  ✅ Inserted ${Math.min(i + batchSize, deconsolidatedRecords.length)}/${deconsolidatedRecords.length}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📊 STEP 5: UPDATING ${rawUpdates.length} RAW TABLE FLAGS`);
  console.log('='.repeat(80) + '\n');

  console.log(`  🚀 Starting optimized batch update...`);

  if (rawUpdates.length > 0) {
    const updateRecords = rawUpdates.map(update => ({
      uuid: update.uuid,
      counteragent_processed: update.counteragent_processed,
      counteragent_found: update.counteragent_found,
      counteragent_missing: update.counteragent_missing,
      payment_id_matched: update.payment_id_matched,
      payment_id_conflict: update.payment_id_conflict,
      parsing_rule_applied: update.parsing_rule_applied,
      parsing_rule_conflict: update.parsing_rule_conflict,
      parsing_rule_processed: true,
      payment_id_processed: true,
      counteragent_inn: update.counteragent_inn,
      applied_rule_id: update.applied_rule_id,
      processing_case: update.processing_case,
      is_processed: true,
      updated_at: new Date().toISOString(),
    }));

    const batchSize = 1000;
    for (let i = 0; i < updateRecords.length; i += batchSize) {
      const batch = updateRecords.slice(i, i + batchSize);
      const { error: updateError } = await supabase
        .from(rawTableName)
        .upsert(batch, {
          onConflict: 'uuid',
          ignoreDuplicates: false,
        });

      if (updateError) throw updateError;
      console.log(`  ✅ Updated ${Math.min(i + batchSize, updateRecords.length)}/${updateRecords.length} records...`);
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
  console.log(`  📦 Total records: ${totalRecords}\n`);

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
  console.log('✅ Import completed successfully!');
  console.log('='.repeat(80) + '\n');
}

/**
 * Backparse existing raw data without importing new XML
 * Applies the same three-phase processing logic to existing records
 */
export async function backparseExistingData(
  accountUuid?: string,
  batchId?: string,
  clearConsolidated: boolean = false
): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 BACKPARSE MODE - Reprocessing Existing Raw Data');
  console.log('='.repeat(80) + '\n');

  const supabase = getSupabaseClient();

  // Get account information
  let accountsQuery = supabase.from('bank_accounts').select('uuid, account, currency_code, parsing_scheme_uuid');

  if (accountUuid) {
    accountsQuery = accountsQuery.eq('uuid', accountUuid);
  } else {
    // Get all accounts with BOG_GEL parsing scheme
    const { data: schemeData } = await supabase
      .from('parsing_schemes')
      .select('uuid')
      .eq('scheme', 'BOG_GEL')
      .single();

    if (schemeData) {
      accountsQuery = accountsQuery.eq('parsing_scheme_uuid', schemeData.uuid);
    }
  }

  const { data: accounts, error: accountsError } = await accountsQuery;

  if (accountsError || !accounts || accounts.length === 0) {
    console.log('❌ No accounts found to process');
    return;
  }

  console.log(`✅ Found ${accounts.length} account(s) to process\n`);

  for (const account of accounts) {
    const accountNumber = account.account;
    const currencyCode = account.currency_code;
    const accountDigits = accountNumber.replace(/\D/g, '').slice(-10);
    const rawTableName = `bog_gel_raw_${accountDigits}`;

    console.log('\n' + '='.repeat(80));
    console.log(`📊 Processing Account: ${accountNumber}`);
    console.log(`📋 Raw Table: ${rawTableName}`);
    console.log('='.repeat(80) + '\n');

    // Optionally clear consolidated data
    if (clearConsolidated) {
      console.log('🗑️  Clearing existing consolidated data...');
      const { error: deleteError } = await supabase
        .from('consolidated_bank_accounts')
        .delete()
        .eq('bank_account_uuid', account.uuid);

      if (deleteError) {
        console.log(`⚠️  Error clearing consolidated data: ${deleteError.message}`);
      } else {
        console.log('✅ Cleared consolidated data\n');
      }
    }

    // Get account currency UUID
    const { data: accountData } = await supabase
      .from('bank_accounts')
      .select('currency_uuid')
      .eq('uuid', account.uuid)
      .single();

    const accountCurrencyUuid = accountData?.currency_uuid;

    // =============================
    // STEP 2: Load Dictionaries
    // =============================
    console.log('🔄 STEP 2: LOADING DICTIONARIES\n');

    const [counteragentsMap, parsingRules, paymentsBundle, nbgRatesMap, currencyCache] =
      await Promise.all([
        loadCounteragents(supabase),
        loadParsingRules(supabase),
        loadPayments(supabase),
        loadNBGRates(supabase),
        loadCurrencyCache(supabase),
      ]);

    const { paymentsMap, salaryBaseMap, salaryLatestMap, duplicatePaymentMap } = paymentsBundle;

    // =============================
    // STEP 3: Three-Phase Processing
    // =============================
    console.log('🔄 STEP 3: THREE-PHASE PROCESSING\n');

    // Get raw records to process
    let rawQuery = supabase
      .from(rawTableName)
      .select(
        'uuid, dockey, entriesid, docrecdate, docvaluedate, entrycramt, entrydbamt, docsenderinn, docbenefinn, docsenderacctno, docbenefacctno, doccoracct, docnomination, docinformation, docprodgroup, ccyrate'
      );

    if (batchId) {
      rawQuery = rawQuery.eq('import_batch_id', batchId);
    }

    const { data: rawRecords, error: fetchError } = await rawQuery;

    if (fetchError) {
      console.log(`❌ Error fetching raw records: ${fetchError.message}`);
      continue;
    }

    const totalRecords = rawRecords?.length || 0;
    console.log(`📦 Processing ${totalRecords} records...\n`);

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
    const consolidatedRecords: ConsolidatedRecord[] = [];
    const rawUpdates: RawUpdate[] = [];

    for (let idx = 0; idx < totalRecords; idx++) {
      const rawRecord = rawRecords[idx];

      const credit = rawRecord.entrycramt ? parseFloat(rawRecord.entrycramt) : 0;
      const debit = rawRecord.entrydbamt ? parseFloat(rawRecord.entrydbamt) : 0;
      const accountCurrencyAmount = credit - debit;

      const transactionDate = parseBOGDate(rawRecord.docvaluedate);
      if (!transactionDate) continue;

      const row = {
        uuid: rawRecord.uuid,
        dockey: rawRecord.dockey,
        entriesid: rawRecord.entriesid,
        docsenderinn: rawRecord.docsenderinn,
        docbenefinn: rawRecord.docbenefinn,
        doccorracct: rawRecord.doccoracct,
        docsenderacctno: rawRecord.docsenderacctno,
        docbenefacctno: rawRecord.docbenefacctno,
        docprodgroup: rawRecord.docprodgroup,
        docnomination: rawRecord.docnomination,
        docinformation: rawRecord.docinformation,
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

      const consolidatedUuid = uuidv4();
      consolidatedRecords.push({
        uuid: consolidatedUuid,
        bank_account_uuid: account.uuid,
        raw_record_uuid: rawRecord.uuid,
        transaction_date: transactionDate,
        description: rawRecord.docnomination || '',
        counteragent_uuid: result.counteragent_uuid,
        counteragent_account_number: result.counteragent_account_number,
        project_uuid: result.project_uuid,
        financial_code_uuid: result.financial_code_uuid,
        payment_id: result.payment_id,
        account_currency_uuid: accountCurrencyUuid,
        account_currency_amount: accountCurrencyAmount,
        nominal_currency_uuid: nominalCurrencyUuid,
        nominal_amount: nominalAmount,
        processing_case: caseDescription,
        applied_rule_id: result.applied_rule_id,
      });

      rawUpdates.push({
        uuid: rawRecord.uuid,
        counteragent_processed: result.case1_counteragent_processed,
        counteragent_found: result.case1_counteragent_found,
        counteragent_missing: result.case3_counteragent_missing,
        payment_id_matched: result.case4_payment_id_matched,
        payment_id_conflict: result.case5_payment_id_conflict,
        parsing_rule_applied: result.case6_parsing_rule_applied,
        parsing_rule_conflict: result.case7_parsing_rule_conflict,
        counteragent_inn: result.counteragent_inn,
        applied_rule_id: result.applied_rule_id,
        processing_case: caseDescription,
      });

      if ((idx + 1) % 1000 === 0 || idx + 1 === totalRecords) {
        console.log(`  ✅ Processed ${idx + 1}/${totalRecords} records...`);
      }
    }

    // Insert consolidated records
    if (consolidatedRecords.length > 0) {
      console.log(`\n💾 Inserting ${consolidatedRecords.length} consolidated records...`);
      const { error: consolidatedError } = await supabase
        .from('consolidated_bank_accounts')
        .upsert(consolidatedRecords, {
          onConflict: 'uuid',
        });

      if (consolidatedError) {
        console.log(`❌ Error inserting consolidated records: ${consolidatedError.message}`);
      } else {
        console.log(`✅ Inserted ${consolidatedRecords.length} consolidated records\n`);
      }
    }

    // Update raw table flags
    if (rawUpdates.length > 0) {
      console.log(`🔄 Updating ${rawUpdates.length} raw table flags...`);

      const updateRecords = rawUpdates.map(update => ({
        uuid: update.uuid,
        counteragent_processed: update.counteragent_processed,
        counteragent_found: update.counteragent_found,
        counteragent_missing: update.counteragent_missing,
        payment_id_matched: update.payment_id_matched,
        payment_id_conflict: update.payment_id_conflict,
        parsing_rule_applied: update.parsing_rule_applied,
        parsing_rule_conflict: update.parsing_rule_conflict,
        parsing_rule_processed: true,
        payment_id_processed: true,
        counteragent_inn: update.counteragent_inn,
        applied_rule_id: update.applied_rule_id,
        processing_case: update.processing_case,
        is_processed: true,
        updated_at: new Date().toISOString(),
      }));

      const batchSize = 1000;
      for (let i = 0; i < updateRecords.length; i += batchSize) {
        const batch = updateRecords.slice(i, i + batchSize);
        const { error: updateError } = await supabase
          .from(rawTableName)
          .upsert(batch, {
            onConflict: 'uuid',
            ignoreDuplicates: false,
          });

        if (updateError) {
          console.log(`❌ Error updating batch: ${updateError.message}`);
        }
      }

      console.log(`✅ Updated ${rawUpdates.length} raw records\n`);
    }

    // Print summary
    console.log('📊 SUMMARY - ' + accountNumber);
    console.log('━'.repeat(80));
    console.log(`Phase 1 - Parsing Rules: ${stats.case6_parsing_rule_match} applied`);
    console.log(`Phase 2 - Counteragent: ${stats.case1_counteragent_processed} matched`);
    console.log(`Phase 3 - Payment ID: ${stats.case4_payment_id_match} matched`);
    console.log(`Total: ${totalRecords} records processed\n`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Backparse completed successfully!');
  console.log('='.repeat(80) + '\n');
}
