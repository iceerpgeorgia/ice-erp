type AnyRecord = Record<string, unknown>;

export type TbcMappedHeader = {
  AccountNo: string;
  Currency: string;
  DateFrom?: string;
  DateTo?: string;
};

export type TbcMappedRecord = {
  Date?: string;
  PaidIn?: string;
  PaidOut?: string;
  Balance?: string;
  Description?: string;
  AdditionalInformation?: string;
  AdditionalDescription?: string;
  TransactionType?: string;
  DocumentDate?: string;
  DocumentNumber?: string;
  PartnerAccountNumber?: string;
  PartnerName?: string;
  PartnerBankCode?: string;
  PartnerBankName?: string;
  OperationCode?: string;
  PartnerTaxCode?: string;
  TaxpayerCode?: string;
  TaxpayerName?: string;
  TransactionId?: string;
};

export type TbcStatementMapOptions = {
  accountNumber?: string;
  currencyCode?: string;
  allowEmptyStatement?: boolean;
};

export type TbcStatementMapResult = {
  xmlContent: string;
  header: TbcMappedHeader;
  detailsCount: number;
};

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function normalizeKey(value: string) {
  return value.replace(/[_\s-]/g, '').toLowerCase();
}

function pickFirst(record: AnyRecord, keys: string[]): string | undefined {
  const mapped = new Map<string, unknown>();
  Object.keys(record).forEach((key) => mapped.set(normalizeKey(key), record[key]));

  for (const key of keys) {
    const value = asString(mapped.get(normalizeKey(key)));
    if (value) return value;
  }
  return undefined;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toTbcDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  const slash = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) return trimmed;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${day}/${month}/${year}`;
  }

  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, year, month, day] = compact;
    return `${day}/${month}/${year}`;
  }

  return trimmed;
}

function detectItems(payload: unknown): AnyRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is AnyRecord => Boolean(item) && typeof item === 'object');
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const root = payload as AnyRecord;
  const statement = (root.statement as AnyRecord | undefined) || (root.data as AnyRecord | undefined) || root;
  const candidates = [
    statement.records,
    statement.Record,
    statement.movements,
    statement.items,
    statement.transactions,
    root.records,
    root.Record,
    root.movements,
    root.items,
    root.transactions,
    (root.result as AnyRecord | undefined)?.records,
    (root.result as AnyRecord | undefined)?.movements,
    (root.result as AnyRecord | undefined)?.items,
    (root.result as AnyRecord | undefined)?.transactions,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is AnyRecord => Boolean(item) && typeof item === 'object');
    }
  }

  return [];
}

function deriveHeader(payload: unknown, options?: TbcStatementMapOptions): TbcMappedHeader {
  const root = (payload && typeof payload === 'object' ? (payload as AnyRecord) : {}) as AnyRecord;
  const statement = ((root.statement as AnyRecord | undefined) || root) as AnyRecord;

  const currency =
    (options?.currencyCode ||
      pickFirst(statement, ['currency', 'ccy', 'accountCurrency']) ||
      pickFirst(root, ['currency', 'ccy', 'accountCurrency']) ||
      'GEL')
      .trim()
      .toUpperCase();

  const accountNo =
    options?.accountNumber ||
    pickFirst(statement, ['accountNo', 'accountNumber', 'iban']) ||
    pickFirst(root, ['accountNo', 'accountNumber', 'iban']) ||
    '';

  return {
    AccountNo: accountNo,
    Currency: currency,
    DateFrom: toTbcDate(
      pickFirst(statement, ['dateFrom', 'fromDate', 'periodFrom']) ||
        pickFirst(root, ['dateFrom', 'fromDate', 'periodFrom'])
    ),
    DateTo: toTbcDate(
      pickFirst(statement, ['dateTo', 'toDate', 'periodTo']) ||
        pickFirst(root, ['dateTo', 'toDate', 'periodTo'])
    ),
  };
}

function mapRecord(record: AnyRecord, index: number): TbcMappedRecord {
  const documentNumber = pickFirst(record, ['DocumentNumber', 'documentNumber', 'docNo']);
  const transactionId = pickFirst(record, ['TransactionId', 'transactionId', 'entryId', 'id']);

  if (!documentNumber || !transactionId) {
    throw new Error(
      `Transaction at index ${index} is missing required DocumentNumber/TransactionId. Synthetic API keys are not allowed.`
    );
  }

  const paidIn = pickFirst(record, ['PaidIn', 'credit', 'amountCredit']) || '0';
  const paidOut = pickFirst(record, ['PaidOut', 'debit', 'amountDebit']) || '0';

  return {
    Date: toTbcDate(pickFirst(record, ['Date', 'valueDate', 'transactionDate'])),
    PaidIn: paidIn,
    PaidOut: paidOut,
    Balance: pickFirst(record, ['Balance', 'runningBalance']),
    Description: pickFirst(record, ['Description', 'purpose', 'details']),
    AdditionalInformation: pickFirst(record, ['AdditionalInformation', 'additionalInfo']),
    AdditionalDescription: pickFirst(record, ['AdditionalDescription', 'comment']),
    TransactionType: pickFirst(record, ['TransactionType', 'type']),
    DocumentDate: toTbcDate(pickFirst(record, ['DocumentDate', 'docDate', 'bookingDate'])),
    DocumentNumber: documentNumber,
    PartnerAccountNumber: pickFirst(record, ['PartnerAccountNumber', 'counterpartyAccount', 'corAccount']),
    PartnerName: pickFirst(record, ['PartnerName', 'counterpartyName']),
    PartnerBankCode: pickFirst(record, ['PartnerBankCode', 'counterpartyBankCode']),
    PartnerBankName: pickFirst(record, ['PartnerBankName', 'counterpartyBankName']),
    OperationCode: pickFirst(record, ['OperationCode', 'operation', 'productGroup']) || 'API',
    PartnerTaxCode: pickFirst(record, ['PartnerTaxCode', 'counterpartyTaxCode', 'inn']),
    TaxpayerCode: pickFirst(record, ['TaxpayerCode', 'payerTaxCode']),
    TaxpayerName: pickFirst(record, ['TaxpayerName', 'payerName']),
    TransactionId: transactionId,
  };
}

function buildXml(header: TbcMappedHeader, records: TbcMappedRecord[]): string {
  const head = [
    '  <Head>',
    `    <AccountNo>${xmlEscape(header.AccountNo)}</AccountNo>`,
    `    <Currency>${xmlEscape(header.Currency)}</Currency>`,
    ...(header.DateFrom ? [`    <DateFrom>${xmlEscape(header.DateFrom)}</DateFrom>`] : []),
    ...(header.DateTo ? [`    <DateTo>${xmlEscape(header.DateTo)}</DateTo>`] : []),
    '  </Head>',
  ];

  const items = records.map((record) => {
    const fields = Object.entries(record)
      .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
      .map(([tag, value]) => `      <${tag}>${xmlEscape(String(value))}</${tag}>`);

    return ['    <Record>', ...fields, '    </Record>'].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<AccountStatement>',
    ...head,
    '  <Records>',
    ...items,
    '  </Records>',
    '</AccountStatement>',
  ].join('\n');
}

function mapJsonPayloadToXml(payload: unknown, options?: TbcStatementMapOptions): TbcStatementMapResult {
  const header = deriveHeader(payload, options);
  if (!header.AccountNo) {
    throw new Error('Failed to infer account number for TBC statement mapping.');
  }

  const sourceRecords = detectItems(payload);
  if (sourceRecords.length === 0 && !options?.allowEmptyStatement) {
    throw new Error('No statement records found in TBC BIS payload.');
  }

  const mapped = sourceRecords.map((item, index) => mapRecord(item, index));
  const xmlContent = buildXml(header, mapped);

  return {
    xmlContent,
    header,
    detailsCount: mapped.length,
  };
}

function parseXmlHeader(xmlContent: string): TbcMappedHeader {
  const accountNo = xmlContent.match(/<AccountNo>([\s\S]*?)<\/AccountNo>/i)?.[1]?.trim() || '';
  const currency = xmlContent.match(/<Currency>([\s\S]*?)<\/Currency>/i)?.[1]?.trim() || 'GEL';
  const dateFrom = xmlContent.match(/<DateFrom>([\s\S]*?)<\/DateFrom>/i)?.[1]?.trim();
  const dateTo = xmlContent.match(/<DateTo>([\s\S]*?)<\/DateTo>/i)?.[1]?.trim();

  return {
    AccountNo: accountNo,
    Currency: currency,
    DateFrom: dateFrom || undefined,
    DateTo: dateTo || undefined,
  };
}

export function mapTbcStatementPayloadToXml(
  payload: unknown,
  options?: TbcStatementMapOptions
): TbcStatementMapResult {
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (trimmed.startsWith('<') && trimmed.includes('<AccountStatement')) {
      const detailsCount = (trimmed.match(/<Record\b/gi) || []).length;
      const header = parseXmlHeader(trimmed);
      if (!header.AccountNo && options?.accountNumber) {
        header.AccountNo = options.accountNumber;
      }
      if (!header.Currency && options?.currencyCode) {
        header.Currency = options.currencyCode.toUpperCase();
      }
      return {
        xmlContent: trimmed,
        header,
        detailsCount,
      };
    }
  }

  return mapJsonPayloadToXml(payload, options);
}

