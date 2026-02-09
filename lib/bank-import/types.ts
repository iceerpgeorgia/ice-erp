/**
 * Type definitions for bank XML import and processing
 * Matches the Python script's data structures
 */

export interface BOGDetailRecord {
  CanCopyDocument?: string;
  CanViewDocument?: string;
  CanPrintDocument?: string;
  IsReval?: string;
  DocNomination?: string;
  DocInformation?: string;
  DocSrcAmt?: string;
  DocSrcCcy?: string;
  DocDstAmt?: string;
  DocDstCcy?: string;
  DocKey?: string;
  DocRecDate?: string;
  DocBranch?: string;
  DocDepartment?: string;
  DocProdGroup?: string;
  DocNo?: string;
  DocValueDate?: string;
  DocSenderName?: string;
  DocSenderInn?: string;
  DocSenderAcctNo?: string;
  DocSenderBic?: string;
  DocActualDate?: string;
  DocCorAcct?: string;
  DocCorBic?: string;
  DocCorBankName?: string;
  EntriesId?: string;
  DocComment?: string;
  CcyRate?: string;
  EntryPDate?: string;
  EntryDocNo?: string;
  EntryLAcct?: string;
  EntryLAcctOld?: string;
  EntryDbAmt?: string;
  EntryDbAmtBase?: string;
  EntryCrAmt?: string;
  EntryCrAmtBase?: string;
  OutBalance?: string;
  EntryAmtBase?: string;
  EntryComment?: string;
  EntryDepartment?: string;
  EntryAcctPoint?: string;
  DocSenderBicName?: string;
  DocBenefName?: string;
  DocBenefInn?: string;
  DocBenefAcctNo?: string;
  DocBenefBic?: string;
  DocBenefBicName?: string;
  DocPayerName?: string;
  DocPayerInn?: string;
}

export interface CounteragentData {
  uuid: string;
  name: string;
  inn: string;
}

export interface ParsingRule {
  id: number;
  counteragent_uuid: string | null;
  financial_code_uuid: string | null;
  nominal_currency_uuid: string | null;
  payment_id: string | null;
  column_name: string | null;
  condition: string | null;
}

export interface PaymentData {
  counteragent_uuid: string | null;
  project_uuid: string | null;
  financial_code_uuid: string | null;
  currency_uuid: string | null;
  accrual_source?: string | null;
  source: 'payments' | 'salary';
}

export interface NBGRates {
  USD?: number;
  EUR?: number;
  CNY?: number;
  GBP?: number;
  RUB?: number;
  TRY?: number;
  AED?: number;
  KZT?: number;
}

export interface ProcessingResult {
  counteragent_uuid: string | null;
  counteragent_account_number: string | null;
  counteragent_inn: string | null;
  project_uuid: string | null;
  financial_code_uuid: string | null;
  nominal_currency_uuid: string | null;
  payment_id: string | null;
  payment_accrual_source?: string | null;
  applied_rule_id: number | null;
  case1_counteragent_processed: boolean;
  case1_counteragent_found: boolean;
  case3_counteragent_missing: boolean;
  case4_payment_id_matched: boolean;
  case5_payment_id_conflict: boolean;
  case6_parsing_rule_applied: boolean;
  case7_parsing_rule_conflict: boolean;
}

export interface ProcessingStats {
  case1_counteragent_processed: number;
  case2_counteragent_inn_blank: number;
  case3_counteragent_inn_nonblank_no_match: number;
  case4_payment_id_match: number;
  case5_payment_id_counteragent_mismatch: number;
  case6_parsing_rule_match: number;
  case7_parsing_rule_counteragent_mismatch: number;
  case8_parsing_rule_dominance: number;
}

export interface ConsolidatedRecord {
  uuid: string;
  bank_account_uuid: string;
  raw_record_uuid: string;
  transaction_date: Date;
  description: string;
  counteragent_uuid: string | null;
  counteragent_account_number: string | null;
  project_uuid: string | null;
  financial_code_uuid: string | null;
  payment_id: string | null;
  account_currency_uuid: string;
  account_currency_amount: number;
  nominal_currency_uuid: string;
  nominal_amount: number;
  processing_case: string;
  applied_rule_id: number | null;
}

export interface RawUpdate {
  uuid: string;
  counteragent_processed: boolean;
  counteragent_found: boolean;
  counteragent_missing: boolean;
  payment_id_matched: boolean;
  payment_id_conflict: boolean;
  parsing_rule_applied: boolean;
  parsing_rule_conflict: boolean;
  counteragent_inn: string | null;
  applied_rule_id: number | null;
  processing_case: string;
}

export interface AccountInfo {
  account_number: string;
  currency_code: string;
  xml_root: any;
}
