type Primitive = string | number | boolean | null | undefined;

type AnyRecord = Record<string, unknown>;

export type BogMappedHeader = {
  AcctNo: string;
  AcctName?: string;
  BIC?: string;
  IBAN?: string;
  DateFrom?: string;
  DateTo?: string;
};

export type BogMappedDetail = {
  DocKey: string;
  EntriesId: string;
  DocRecDate?: string;
  DocBranch?: string;
  DocDepartment?: string;
  DocValueDate?: string;
  DocActualDate?: string;
  DocInformation?: string;
  DocNomination?: string;
  DocProdGroup?: string;
  DocNo?: string;
  DocSenderName?: string;
  DocSenderInn?: string;
  DocSenderAcctNo?: string;
  DocSenderBic?: string;
  DocSenderBicName?: string;
  DocBenefName?: string;
  DocBenefInn?: string;
  DocBenefAcctNo?: string;
  DocBenefBic?: string;
  DocBenefBicName?: string;
  DocPayerName?: string;
  DocPayerInn?: string;
  DocCorAcct?: string;
  DocCorBic?: string;
  DocCorBankName?: string;
  DocComment?: string;
  DocSrcAmt?: string;
  DocSrcCcy?: string;
  DocDstAmt?: string;
  DocDstCcy?: string;
  EntryDbAmt?: string;
  EntryCrAmt?: string;
  EntryDbAmtBase?: string;
  EntryCrAmtBase?: string;
  OutBalance?: string;
  EntryAmtBase?: string;
  EntryComment?: string;
  EntryPDate?: string;
  EntryDocNo?: string;
  EntryLAcct?: string;
  EntryLAcctOld?: string;
  EntryDepartment?: string;
  EntryAcctPoint?: string;
  CcyRate?: string;
  CanCopyDocument?: string;
  CanViewDocument?: string;
  CanPrintDocument?: string;
  IsReval?: string;
};

export type StatementMapOptions = {
  accountNoWithCurrency?: string;
  currencyCode?: string;
  allowEmptyStatement?: boolean;
};

export type StatementMapResult = {
  xmlContent: string;
  header: BogMappedHeader;
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

function pickFirst(record: AnyRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return undefined;
}

function toBogDate(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}.${month}.${year}`;
  }

  const compactMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return `${day}.${month}.${year}`;
  }

  const dottedMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dottedMatch) {
    return value;
  }

  return value;
}

function detectItems(payload: unknown): AnyRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is AnyRecord => Boolean(item) && typeof item === 'object');
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const source = payload as AnyRecord;
  const candidates = [
    source.Records,
    source.transactions,
    source.items,
    source.records,
    source.data,
    (source.data as AnyRecord | undefined)?.Records,
    (source.data as AnyRecord | undefined)?.records,
    (source.result as AnyRecord | undefined)?.Records,
    source.statementItems,
    (source.result as AnyRecord | undefined)?.transactions,
    (source.result as AnyRecord | undefined)?.items,
    (source.result as AnyRecord | undefined)?.records,
    (source.statement as AnyRecord | undefined)?.Records,
    (source.statement as AnyRecord | undefined)?.transactions,
    (source.statement as AnyRecord | undefined)?.items,
    (source.statement as AnyRecord | undefined)?.records,
  ];

  for (const entry of candidates) {
    if (Array.isArray(entry)) {
      return entry.filter((item): item is AnyRecord => Boolean(item) && typeof item === 'object');
    }
  }

  return [];
}

function deriveHeader(payload: unknown, options?: StatementMapOptions): BogMappedHeader {
  const root = (payload && typeof payload === 'object' ? (payload as AnyRecord) : {}) as AnyRecord;
  const statement = ((root.statement as AnyRecord | undefined) || root) as AnyRecord;

  const currency = (options?.currencyCode || pickFirst(statement, ['currency', 'ccy', 'accountCurrency']) || 'GEL').toUpperCase();
  const accountCandidate =
    options?.accountNoWithCurrency ||
    pickFirst(statement, ['accountNoWithCurrency', 'accountWithCurrency', 'accountNo', 'accountNumber', 'iban']) ||
    pickFirst(root, ['accountNoWithCurrency', 'accountWithCurrency', 'accountNo', 'accountNumber', 'iban']) ||
    '';

  const accountNoWithCurrency = accountCandidate.endsWith(currency)
    ? accountCandidate
    : `${accountCandidate}${currency}`;

  return {
    AcctNo: accountNoWithCurrency,
    AcctName: pickFirst(statement, ['accountName', 'name']),
    BIC: pickFirst(statement, ['bic', 'bankBic']),
    IBAN: pickFirst(statement, ['iban']),
    DateFrom: toBogDate(pickFirst(statement, ['dateFrom', 'fromDate', 'periodFrom'])),
    DateTo: toBogDate(pickFirst(statement, ['dateTo', 'toDate', 'periodTo'])),
  };
}

function mapDetail(tx: AnyRecord, index: number): BogMappedDetail {
  const explicitDocKey = pickFirst(tx, ['DocKey', 'docKey', 'DocumentKey', 'documentKey']);
  const explicitEntriesId = pickFirst(tx, ['EntriesId', 'entriesId', 'EntryId', 'entryId']);
  if (!explicitDocKey || !explicitEntriesId) {
    throw new Error(
      `Transaction at index ${index} is missing required DocKey/EntriesId. Synthetic API keys are not allowed.`
    );
  }
  const sender = (tx.SenderDetails as AnyRecord | undefined) || {};
  const beneficiary = (tx.BeneficiaryDetails as AnyRecord | undefined) || {};

  const amountRaw = pickFirst(tx, ['EntryAmount', 'entryAmount', 'amount', 'txnAmount']);
  const debitRaw = pickFirst(tx, ['EntryAmountDebit', 'entryAmountDebit', 'EntryDbAmt', 'entryDbAmt', 'debit']);
  const creditRaw = pickFirst(tx, ['EntryAmountCredit', 'entryAmountCredit', 'EntryCrAmt', 'entryCrAmt', 'credit']);

  let entryDbAmt = debitRaw;
  let entryCrAmt = creditRaw;

  if (!entryDbAmt && !entryCrAmt && amountRaw) {
    const n = Number(amountRaw);
    if (!Number.isNaN(n)) {
      if (n < 0) {
        entryDbAmt = String(Math.abs(n));
        entryCrAmt = '0';
      } else {
        entryDbAmt = '0';
        entryCrAmt = String(n);
      }
    }
  }

  const valueDate = toBogDate(
    pickFirst(tx, ['DocumentValueDate', 'documentValueDate', 'DocValueDate', 'docValueDate', 'valueDate', 'date', 'transactionDate'])
  );
  const recDate = toBogDate(
    pickFirst(tx, ['DocumentReceiveDate', 'documentReceiveDate', 'DocRecDate', 'docRecDate', 'recordDate', 'bookingDate']) || valueDate
  );

  return {
    DocKey: explicitDocKey,
    EntriesId: explicitEntriesId,
    DocRecDate: recDate,
    DocBranch: pickFirst(tx, ['DocumentBranch', 'documentBranch', 'DocBranch', 'docBranch']),
    DocDepartment: pickFirst(tx, ['DocumentDepartment', 'documentDepartment', 'DocDepartment', 'docDepartment']),
    DocValueDate: valueDate,
    DocActualDate: toBogDate(pickFirst(tx, ['DocActualDate', 'docActualDate', 'actualDate']) || valueDate),
    DocInformation: pickFirst(tx, ['DocumentInformation', 'documentInformation', 'DocInformation', 'docInformation', 'description', 'details', 'paymentDetails']),
    DocNomination: pickFirst(tx, ['DocumentNomination', 'documentNomination', 'DocNomination', 'docNomination', 'purpose', 'paymentPurpose', 'description']),
    DocProdGroup: pickFirst(tx, ['DocumentProductGroup', 'documentProductGroup', 'DocProdGroup', 'docProdGroup', 'productGroup']) || 'API',
    DocNo: pickFirst(tx, ['EntryDocumentNumber', 'entryDocumentNumber', 'DocNo', 'docNo', 'documentNo']),
    DocSenderName: pickFirst(tx, ['DocSenderName', 'docSenderName', 'senderName']) || pickFirst(sender, ['Name', 'name']),
    DocSenderInn: pickFirst(tx, ['DocSenderInn', 'docSenderInn', 'senderInn', 'senderTaxId']) || pickFirst(sender, ['Inn', 'inn']),
    DocSenderAcctNo: pickFirst(tx, ['DocSenderAcctNo', 'docSenderAcctNo', 'senderAccount', 'fromAccount']) || pickFirst(sender, ['AccountNumber', 'accountNumber']),
    DocSenderBic: pickFirst(tx, ['DocSenderBic', 'docSenderBic', 'senderBic']) || pickFirst(sender, ['BankCode', 'bankCode']),
    DocSenderBicName: pickFirst(tx, ['DocSenderBicName', 'docSenderBicName', 'senderBankName']) || pickFirst(sender, ['BankName', 'bankName']),
    DocBenefName: pickFirst(tx, ['DocBenefName', 'docBenefName', 'beneficiaryName', 'receiverName']) || pickFirst(beneficiary, ['Name', 'name']),
    DocBenefInn: pickFirst(tx, ['DocBenefInn', 'docBenefInn', 'beneficiaryInn', 'receiverTaxId']) || pickFirst(beneficiary, ['Inn', 'inn']),
    DocBenefAcctNo: pickFirst(tx, ['DocBenefAcctNo', 'docBenefAcctNo', 'beneficiaryAccount', 'toAccount']) || pickFirst(beneficiary, ['AccountNumber', 'accountNumber']),
    DocBenefBic: pickFirst(tx, ['DocBenefBic', 'docBenefBic', 'beneficiaryBic']) || pickFirst(beneficiary, ['BankCode', 'bankCode']),
    DocBenefBicName: pickFirst(tx, ['DocBenefBicName', 'docBenefBicName', 'beneficiaryBankName']) || pickFirst(beneficiary, ['BankName', 'bankName']),
    DocPayerName: pickFirst(tx, ['DocumentPayerName', 'documentPayerName', 'DocPayerName', 'docPayerName', 'payerName']),
    DocPayerInn: pickFirst(tx, ['DocumentPayerInn', 'documentPayerInn', 'DocPayerInn', 'docPayerInn', 'payerInn']),
    DocCorAcct: pickFirst(tx, ['DocumentCorrespondentAccountNumber', 'documentCorrespondentAccountNumber', 'DocCorAcct', 'docCorAcct', 'correspondentAccount']),
    DocCorBic: pickFirst(tx, ['DocumentCorrespondentBankCode', 'documentCorrespondentBankCode', 'DocCorBic', 'docCorBic', 'correspondentBic']),
    DocCorBankName: pickFirst(tx, ['DocumentCorrespondentBankName', 'documentCorrespondentBankName', 'DocCorBankName', 'docCorBankName', 'correspondentBankName']),
    DocComment: pickFirst(tx, ['DocComment', 'docComment']),
    DocSrcAmt: pickFirst(tx, ['DocumentSourceAmount', 'documentSourceAmount', 'DocSrcAmt', 'docSrcAmt', 'sourceAmount']) || amountRaw,
    DocSrcCcy: pickFirst(tx, ['DocumentSourceCurrency', 'documentSourceCurrency', 'DocSrcCcy', 'docSrcCcy', 'sourceCurrency', 'currency']),
    DocDstAmt: pickFirst(tx, ['DocumentDestinationAmount', 'documentDestinationAmount', 'DocDstAmt', 'docDstAmt', 'destinationAmount']) || amountRaw,
    DocDstCcy: pickFirst(tx, ['DocumentDestinationCurrency', 'documentDestinationCurrency', 'DocDstCcy', 'docDstCcy', 'destinationCurrency', 'currency']),
    EntryDbAmt: entryDbAmt,
    EntryCrAmt: entryCrAmt,
    EntryDbAmtBase: pickFirst(tx, ['EntryAmountDebitBase', 'entryAmountDebitBase', 'EntryDbAmtBase', 'entryDbAmtBase']),
    EntryCrAmtBase: pickFirst(tx, ['EntryAmountCreditBase', 'entryAmountCreditBase', 'EntryCrAmtBase', 'entryCrAmtBase']),
    OutBalance: pickFirst(tx, ['OutBalance', 'outBalance']),
    EntryAmtBase: pickFirst(tx, ['EntryAmountBase', 'entryAmountBase', 'EntryAmtBase', 'entryAmtBase']),
    EntryComment: pickFirst(tx, ['EntryComment', 'entryComment']),
    EntryPDate: toBogDate(pickFirst(tx, ['EntryDate', 'entryDate', 'EntryPDate', 'entryPDate']) || valueDate),
    EntryDocNo: pickFirst(tx, ['EntryDocumentNumber', 'entryDocumentNumber', 'EntryDocNo', 'entryDocNo']),
    EntryLAcct: pickFirst(tx, ['EntryAccountNumber', 'entryAccountNumber', 'EntryLAcct', 'entryLAcct']),
    EntryLAcctOld: pickFirst(tx, ['EntryLAcctOld', 'entryLAcctOld']),
    EntryDepartment: pickFirst(tx, ['EntryDepartment', 'entryDepartment']),
    EntryAcctPoint: pickFirst(tx, ['EntryAccountPoint', 'entryAccountPoint', 'EntryAcctPoint', 'entryAcctPoint']),
    CcyRate: pickFirst(tx, ['DocumentRate', 'documentRate', 'CcyRate', 'ccyRate', 'exchangeRate']),
    CanCopyDocument: pickFirst(tx, ['CanCopyDocument', 'canCopyDocument']) || '1',
    CanViewDocument: pickFirst(tx, ['CanViewDocument', 'canViewDocument']) || '1',
    CanPrintDocument: pickFirst(tx, ['CanPrintDocument', 'canPrintDocument']) || '1',
    IsReval: pickFirst(tx, ['IsReval', 'isReval']) || '0',
  };
}

function escapeXml(value: Primitive): string {
  const text = value === null || value === undefined ? '' : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function objectToXmlNode(tagName: string, data: Record<string, Primitive>): string {
  const parts: string[] = [];
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (value === undefined || value === null || value === '') continue;
    parts.push(`    <${key}>${escapeXml(value)}</${key}>`);
  }
  return `  <${tagName}>\n${parts.join('\n')}\n  </${tagName}>`;
}

function buildXml(header: BogMappedHeader, details: BogMappedDetail[]): string {
  const headerXml = objectToXmlNode('HEADER', header as Record<string, Primitive>);
  const detailNodes = details.map((detail) => objectToXmlNode('DETAIL', detail as Record<string, Primitive>));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<AccountStatement>',
    headerXml,
    '  <DETAILS>',
    detailNodes.join('\n'),
    '  </DETAILS>',
    '</AccountStatement>',
  ].join('\n');
}

export function mapBogStatementPayloadToXml(payload: unknown, options?: StatementMapOptions): StatementMapResult {
  const items = detectItems(payload);
  if (items.length === 0 && !options?.allowEmptyStatement) {
    throw new Error('Could not detect statement transactions in BOG API response.');
  }

  const header = deriveHeader(payload, options);
  if (!header.AcctNo || header.AcctNo.length <= 3) {
    throw new Error('Mapped HEADER.AcctNo is invalid. Provide accountNoWithCurrency in request.');
  }

  if (items.length === 0) {
    return {
      xmlContent: buildXml(header, []),
      header,
      detailsCount: 0,
    };
  }

  const details = items.map((tx, index) => mapDetail(tx, index + 1));
  const xmlContent = buildXml(header, details);

  return {
    xmlContent,
    header,
    detailsCount: details.length,
  };
}
