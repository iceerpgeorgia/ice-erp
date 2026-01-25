/**
 * BOG GEL XML Import Processor - TypeScript Implementation
 * Direct equivalent of import_bank_xml_data.py for Vercel
 * 
 * Implements three-phase processing hierarchy (by PRIORITY):
 * Phase 1: Parsing Rules (HIGHEST PRIORITY - IMMUTABLE if matched)
 * Phase 2: Counteragent identification by INN (Second priority)
 * Phase 3: Payment ID matching (LOWEST PRIORITY - Neglected if conflicts)
 */

import { parseStringPromise } from 'xml2js';
import { createHash } from 'crypto';
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

  return cases.length > 0 ? cases.join('\n') : 'No case matched';
}

/**
 * Process a single record through three-phase hierarchy
 * Matches Python process_single_record() function exactly
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

function processSingleRecord(
  row: Record<string, any>,
  counteragentsMap: Map<string, CounteragentData>,
  parsingRules: ParsingRule[],
  paymentsMap: Map<string, PaymentData>,
  salaryBaseMap: Map<string, PaymentData>,
  salaryLatestMap: Map<string, { month: number; year: number; data: PaymentData }>,
  idx: number,
  stats: ProcessingStats,
  missingCounteragents: Map<string, { inn: string; count: number; name: string }>
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
  // PHASE 1: Parsing Rules (HIGHEST PRIORITY)
  // =============================

  let matchedRule: ParsingRule | null = null;
  for (const rule of parsingRules) {
    const columnName = rule.column_name;
    const condition = rule.condition;
    if (!columnName || !condition) continue;

    const fieldMap: Record<string, any> = {
      docprodgroup: DocProdGroup,
      docnomination: DocNomination,
      docinformation: DocInformation,
      dockey: DocKey,
    };

    const fieldValue = fieldMap[columnName.toLowerCase()];

    if (fieldValue && String(fieldValue).trim() === String(condition).trim()) {
      matchedRule = rule;
      break;
    }
  }

  if (matchedRule) {
    const rulePaymentId = matchedRule.payment_id;
    let rulePaymentData: PaymentData | null = null;

    if (rulePaymentId) {
      rulePaymentData = paymentsMap.get(rulePaymentId.toLowerCase()) || null;
    }

    result.applied_rule_id = matchedRule.id;

    // Phase 1 sets counteragent (HIGHEST PRIORITY - IMMUTABLE)
    let ruleCounteragent = matchedRule.counteragent_uuid;
    if (!ruleCounteragent && rulePaymentData) {
      ruleCounteragent = rulePaymentData.counteragent_uuid;
    }

    if (ruleCounteragent) {
      result.counteragent_uuid = ruleCounteragent;
      result.case6_parsing_rule_applied = true;
    }

    // Apply rule parameters
    if (matchedRule.financial_code_uuid) {
      result.financial_code_uuid = matchedRule.financial_code_uuid;
    } else if (rulePaymentData?.financial_code_uuid) {
      result.financial_code_uuid = rulePaymentData.financial_code_uuid;
    }

    if (matchedRule.nominal_currency_uuid) {
      result.nominal_currency_uuid = matchedRule.nominal_currency_uuid;
    } else if (rulePaymentData?.currency_uuid) {
      result.nominal_currency_uuid = rulePaymentData.currency_uuid;
    }

    if (rulePaymentData?.project_uuid) {
      result.project_uuid = rulePaymentData.project_uuid;
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
  // PHASE 3: Payment ID (LOWEST PRIORITY)
  // =============================

  const extractedPaymentId = extractPaymentID(DocInformation);
  if (extractedPaymentId) {
    const paymentIdLower = extractedPaymentId.toLowerCase();
    let paymentData = paymentsMap.get(paymentIdLower) || null;
    let resolvedPaymentId = extractedPaymentId;

    if (!paymentData && isValidSalaryPeriodSuffix(paymentIdLower)) {
      const baseKey = getSalaryBaseKey(paymentIdLower);
      if (baseKey && salaryBaseMap.has(baseKey)) {
        paymentData = salaryBaseMap.get(baseKey) || null;
      }
    }

    if (!paymentData) {
      const baseKey = getSalaryBaseKey(paymentIdLower);
      if (baseKey && salaryBaseMap.has(baseKey)) {
        paymentData = salaryBaseMap.get(baseKey) || null;

        if (!isValidSalaryPeriodSuffix(paymentIdLower) && salaryLatestMap.has(baseKey)) {
          const latest = salaryLatestMap.get(baseKey)!;
          const next = nextMonth({ month: latest.month, year: latest.year });
          const baseOriginal = extractedPaymentId.trim().slice(0, 20);
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
        console.log(`  💳 Record ${idx}: Payment ID matched: ${extractedPaymentId}`);
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
      tagNameProcessors: [
        // Remove namespace prefixes (gemini:AccountStatement -> AccountStatement)
        (name) => name.replace(/^[^:]+:/, '')
      ]
    });
    
    // BOG GEL format can have different root elements:
    // - gemini:AccountStatement (with namespace)
    // - AccountStatement (without namespace)
    // - STATEMENT, ROWDATA, etc.
    let root = parsed.AccountStatement || parsed.STATEMENT || parsed.ROWDATA || parsed;
    
    // Handle case where xml2js wraps everything in an extra layer
    if (root && typeof root === 'object' && !root.HEADER && !root.DETAILS && !root.DETAIL) {
      const keys = Object.keys(root);
      if (keys.length === 1) {
        root = root[keys[0]];
      }
    }
    
    const header = root?.HEADER?.[0];

    if (!header) {
      console.log('⚠️ No HEADER found in XML. Root keys:', Object.keys(root || {}));
      console.log('Parsed structure:', JSON.stringify(Object.keys(parsed), null, 2));
      return null;
    }

    const accountInfoText = header.AcctNo?.[0] || '';
    const accountFull = accountInfoText.split(' ')[0];

    if (accountFull.length > 3) {
      const currencyCode = accountFull.substring(accountFull.length - 3);
      return {
        account_number: accountFull,
        currency_code: currencyCode,
        xml_root: root,
      };
    }

    return null;
  } catch (error) {
    console.log(`⚠️ Could not parse as BOG GEL format: ${error}`);
    return null;
  }
}

/**
 * Main processing function - equivalent to Python process_bog_gel()
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
      .eq('DocKey', DocKey)
      .eq('EntriesId', EntriesId)
      .single();

    if (existing) {
      skippedRawDuplicates++;
      continue;
    }

    // Generate UUID
    const recordUuidStr = `${DocKey}_${EntriesId}`;
    const recordUuid = uuidv5(recordUuidStr, DNS_NAMESPACE);

    rawRecordsToInsert.push({
      uuid: recordUuid,
      CanCopyDocument: getText('CanCopyDocument'),
      CanViewDocument: getText('CanViewDocument'),
      CanPrintDocument: getText('CanPrintDocument'),
      IsReval: getText('IsReval'),
      DocNomination: getText('DocNomination'),
      DocInformation: getText('DocInformation'),
      DocSrcAmt: getText('DocSrcAmt'),
      DocSrcCcy: getText('DocSrcCcy'),
      DocDstAmt: getText('DocDstAmt'),
      DocDstCcy: getText('DocDstCcy'),
      DocKey: DocKey,
      DocRecDate: getText('DocRecDate'),
      DocBranch: getText('DocBranch'),
      DocDepartment: getText('DocDepartment'),
      DocProdGroup: getText('DocProdGroup'),
      DocNo: getText('DocNo'),
      DocValueDate: getText('DocValueDate'),
      DocSenderName: getText('DocSenderName'),
      DocSenderInn: getText('DocSenderInn'),
      DocSenderAcctNo: getText('DocSenderAcctNo'),
      DocSenderBic: getText('DocSenderBic'),
      DocActualDate: getText('DocActualDate'),
      DocCorAcct: getText('DocCorAcct'),
      DocCorBic: getText('DocCorBic'),
      DocCorBankName: getText('DocCorBankName'),
      EntriesId: EntriesId,
      DocComment: getText('DocComment'),
      CcyRate: getText('CcyRate'),
      EntryPDate: getText('EntryPDate'),
      EntryDocNo: getText('EntryDocNo'),
      EntryLAcct: getText('EntryLAcct'),
      EntryLAcctOld: getText('EntryLAcctOld'),
      EntryDbAmt: getText('EntryDbAmt'),
      EntryDbAmtBase: getText('EntryDbAmtBase'),
      EntryCrAmt: getText('EntryCrAmt'),
      EntryCrAmtBase: getText('EntryCrAmtBase'),
      OutBalance: getText('OutBalance'),
      EntryAmtBase: getText('EntryAmtBase'),
      EntryComment: getText('EntryComment'),
      EntryDepartment: getText('EntryDepartment'),
      EntryAcctPoint: getText('EntryAcctPoint'),
      DocSenderBicName: getText('DocSenderBicName'),
      DocBenefName: getText('DocBenefName'),
      DocBenefInn: getText('DocBenefInn'),
      DocBenefAcctNo: getText('DocBenefAcctNo'),
      DocBenefBic: getText('DocBenefBic'),
      DocBenefBicName: getText('DocBenefBicName'),
      DocPayerName: getText('DocPayerName'),
      DocPayerInn: getText('DocPayerInn'),
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
    return;
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

  const { paymentsMap, salaryBaseMap, salaryLatestMap } = paymentsBundle;

  // =============================
  // STEP 3: Three-Phase Processing
  // =============================
  console.log('\n' + '='.repeat(80));
  console.log('🔄 STEP 3: THREE-PHASE PROCESSING WITH HIERARCHY');
  console.log('='.repeat(80) + '\n');

  const { data: rawRecords, error: fetchError } = await supabase
    .from(rawTableName)
    .select(
      'uuid, DocKey, EntriesId, DocRecDate, DocValueDate, EntryCrAmt, EntryDbAmt, DocSenderInn, DocBenefInn, DocSenderAcctNo, DocBenefAcctNo, DocCorAcct, DocNomination, DocInformation, DocProdGroup, CcyRate'
    )
    .eq('import_batch_id', importBatchId)
    .order('DocValueDate', { ascending: false });

  if (fetchError) throw fetchError;

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

    const credit = rawRecord.EntryCrAmt ? parseFloat(rawRecord.EntryCrAmt) : 0;
    const debit = rawRecord.EntryDbAmt ? parseFloat(rawRecord.EntryDbAmt) : 0;
    const accountCurrencyAmount = credit - debit;

    const transactionDate = parseBOGDate(rawRecord.DocValueDate);
    if (!transactionDate) continue;

    const row = {
      uuid: rawRecord.uuid,
      dockey: rawRecord.DocKey,
      entriesid: rawRecord.EntriesId,
      docsenderinn: rawRecord.DocSenderInn,
      docbenefinn: rawRecord.DocBenefInn,
      doccorracct: rawRecord.DocCorAcct,
      docsenderacctno: rawRecord.DocSenderAcctNo,
      docbenefacctno: rawRecord.DocBenefAcctNo,
      docprodgroup: rawRecord.DocProdGroup,
      docnomination: rawRecord.DocNomination,
      docinformation: rawRecord.DocInformation,
      debit: debit,
    };

    const result = processSingleRecord(
      row,
      counteragentsMap,
      parsingRules,
      paymentsMap,
      salaryBaseMap,
      salaryLatestMap,
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

    consolidatedRecords.push({
      uuid: uuidv4(),
      bank_account_uuid: bankAccountUuid,
      raw_record_uuid: rawRecord.uuid,
      transaction_date: transactionDate,
      description: rawRecord.DocNomination || '',
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

  console.log('📋 Phase 1 - Counteragent Identification:');
  console.log(`  ✅ Case 1 (Counteragent matched): ${stats.case1_counteragent_processed}`);
  console.log(`  ⚠️  Case 3 (INN no match): ${stats.case3_counteragent_inn_nonblank_no_match}`);
  console.log(`  ℹ️  Case 2 (INN blank): ${stats.case2_counteragent_inn_blank}\n`);

  console.log('📋 Phase 2 - Parsing Rules:');
  console.log(`  ✅ Rules applied: ${stats.case6_parsing_rule_match}`);
  console.log(`  ⚠️  Conflicts (kept counteragent): ${stats.case7_parsing_rule_counteragent_mismatch}\n`);

  console.log('📋 Phase 3 - Payment ID:');
  console.log(`  ✅ Payment matched: ${stats.case4_payment_id_match}`);
  console.log(`  ⚠️  Conflicts (kept counteragent): ${stats.case5_payment_id_counteragent_mismatch}\n`);

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
