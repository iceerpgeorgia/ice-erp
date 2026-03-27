require('dotenv/config');

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Client } = require('pg');

const SOURCE_DIR = path.resolve(process.cwd(), 'TBC Missing Accounts');
const OUTPUT_DIR = path.resolve(process.cwd(), 'exports');
const HEADER_TO_KEY = {
  'თარიღი': 'date',
  'დანიშნულება': 'description',
  'დამატებითი ინფორმაცია': 'additionalInfo',
  'გასული თანხა': 'paidOut',
  'შემოსული თანხა': 'paidIn',
  'ნაშთი': 'balance',
  'ტრანზაქციის ტიპი': 'transactionType',
  'საბუთის თარიღი': 'documentDate',
  'საბუთის №': 'documentNumber',
  'პარტნიორის ანგარიში': 'partnerAccountNumber',
  'პარტნიორი': 'partnerName',
  'პარტნიორის საგადასახადო კოდი': 'partnerTaxCode',
  'პარტნიორის ბანკის კოდი': 'partnerBankCode',
  'პარტნიორის ბანკი': 'partnerBankName',
  'შუამავალი ბანკის კოდი': 'intermediaryBankCode',
  'შუამავალი ბანკი': 'intermediaryBankName',
  'ხარჯის ტიპი': 'chargeType',
  'გადასახადის გადამხდელის კოდი': 'taxpayerCode',
  'გადასახადის გადამხდელის დასახელება': 'taxpayerName',
  'სახაზინო კოდი': 'treasuryCode',
  'ოპ. კოდი': 'operationCode',
  'დამატებითი დანიშნულება': 'additionalDescription',
  'ტრანზაქციის ID': 'transactionId',
  'Record_ID': 'recordId',
};

const PARSED_HEADER_TO_KEY = {
  'Account Number and currency': 'accountNoWithCurrency',
  'Caunteragent_uuid': 'counteragentUuid',
  'project_uuid': 'projectUuid',
  'code_uuid': 'financialCodeUuid',
  'date': 'date',
  'Amount': 'amount',
  'entriesid': 'entriesId',
  'dockey': 'docKey',
  'nominal_currency': 'nominalCurrency',
  'nominal_amount': 'nominalAmount',
  'Order_ID': 'orderId',
  'comment': 'comment',
  'description': 'description',
  'CA Account': 'counteragentAccountNumber',
};

function sanitizeTableName(name) {
  const value = String(name || '').trim();
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe table name: ${name}`);
  }
  return value;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).replace(/,/g, '').trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m}-${d}`;
  }

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return raw;
}

function parseAccountCurrencyFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename)).trim();
  const m = base.match(/^(GE[0-9A-Z]+)([A-Z]{3})$/i);
  if (!m) return null;
  return {
    accountNumber: m[1].toUpperCase(),
    currencyCode: m[2].toUpperCase(),
    accountNoWithCurrency: `${m[1].toUpperCase()}${m[2].toUpperCase()}`,
    tableName: `${m[1].toUpperCase()}_TBC_${m[2].toUpperCase()}`,
  };
}

function mapRowByHeaders(row, headers, mapObj) {
  const out = {};
  for (let i = 0; i < headers.length; i += 1) {
    const key = mapObj[String(headers[i] || '').trim()];
    if (!key) continue;
    out[key] = row[i];
  }
  return out;
}

function transactionKey(accountNumber, docKey, entriesId) {
  const a = String(accountNumber || '').trim().toUpperCase();
  const d = String(docKey || '').trim();
  const e = String(entriesId || '').trim();
  return `${a}||${d}||${e}`;
}

function readOriginalAccountWorkbooks() {
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.toLowerCase().endsWith('.xlsx') && f !== 'Parsed data.xlsx')
    .sort();

  const rows = [];
  const accountMeta = [];

  for (const file of files) {
    const parsedMeta = parseAccountCurrencyFromFilename(file);
    if (!parsedMeta) continue;

    const wb = XLSX.readFile(path.join(SOURCE_DIR, file), { raw: false, defval: '' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    const headers = (matrix[0] || []).map((h) => String(h || '').trim());

    let count = 0;
    for (let i = 1; i < matrix.length; i += 1) {
      const row = matrix[i];
      if (!row || row.every((c) => String(c || '').trim() === '')) continue;

      const mapped = mapRowByHeaders(row, headers, HEADER_TO_KEY);
      const paidIn = toNumber(mapped.paidIn);
      const paidOut = toNumber(mapped.paidOut);
      const amountSigned = paidIn !== null || paidOut !== null ? (paidIn || 0) - (paidOut || 0) : null;

      const rec = {
        sourceFile: file,
        sourceSheet: sheetName,
        accountNumber: parsedMeta.accountNumber,
        currencyCode: parsedMeta.currencyCode,
        accountNoWithCurrency: parsedMeta.accountNoWithCurrency,
        tableName: parsedMeta.tableName,
        date: normalizeDate(mapped.date),
        documentDate: normalizeDate(mapped.documentDate),
        docKey: mapped.transactionId ? String(mapped.transactionId).trim() : null,
        entriesId: mapped.documentNumber ? String(mapped.documentNumber).trim() : null,
        amountSigned,
        paidIn,
        paidOut,
        description: String(mapped.description || '').trim() || null,
        additionalInfo: String(mapped.additionalInfo || '').trim() || null,
        additionalDescription: String(mapped.additionalDescription || '').trim() || null,
        operationCode: String(mapped.operationCode || '').trim() || null,
        partnerAccountNumber: String(mapped.partnerAccountNumber || '').trim() || null,
        partnerTaxCode: String(mapped.partnerTaxCode || '').trim() || null,
        partnerName: String(mapped.partnerName || '').trim() || null,
        recordId: String(mapped.recordId || '').trim() || null,
      };

      rec.txKey = transactionKey(rec.accountNumber, rec.docKey, rec.entriesId);
      rows.push(rec);
      count += 1;
    }

    accountMeta.push({
      file,
      accountNumber: parsedMeta.accountNumber,
      currencyCode: parsedMeta.currencyCode,
      tableName: parsedMeta.tableName,
      rowCount: count,
    });
  }

  return { rows, accountMeta };
}

function readParsedWorkbook(allowedAccountNoWithCurrency) {
  const file = path.join(SOURCE_DIR, 'Parsed data.xlsx');
  const wb = XLSX.readFile(file, { raw: false, defval: '' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const headers = (matrix[0] || []).map((h) => String(h || '').trim());

  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!row || row.every((c) => String(c || '').trim() === '')) continue;

    const mapped = mapRowByHeaders(row, headers, PARSED_HEADER_TO_KEY);
    const accountNoWithCurrency = String(mapped.accountNoWithCurrency || '').trim().toUpperCase();
    if (!accountNoWithCurrency) continue;
    if (allowedAccountNoWithCurrency && !allowedAccountNoWithCurrency.has(accountNoWithCurrency)) {
      continue;
    }

    const accountNumber = accountNoWithCurrency.slice(0, -3);
    const currencyCode = accountNoWithCurrency.slice(-3);

    const rec = {
      accountNoWithCurrency,
      accountNumber,
      currencyCode,
      tableName: `${accountNumber}_TBC_${currencyCode}`,
      date: normalizeDate(mapped.date),
      amount: toNumber(mapped.amount),
      docKey: mapped.docKey ? String(mapped.docKey).trim() : null,
      entriesId: mapped.entriesId ? String(mapped.entriesId).trim() : null,
      nominalCurrency: String(mapped.nominalCurrency || '').trim() || null,
      nominalAmount: toNumber(mapped.nominalAmount),
      counteragentUuid: String(mapped.counteragentUuid || '').trim() || null,
      projectUuid: String(mapped.projectUuid || '').trim() || null,
      financialCodeUuid: String(mapped.financialCodeUuid || '').trim() || null,
      counteragentAccountNumber: String(mapped.counteragentAccountNumber || '').trim() || null,
      orderId: String(mapped.orderId || '').trim() || null,
      comment: String(mapped.comment || '').trim() || null,
      description: String(mapped.description || '').trim() || null,
    };

    rec.txKey = transactionKey(rec.accountNumber, rec.docKey, rec.entriesId);
    rows.push(rec);
  }

  return rows;
}

async function loadDbRows(client, accountMeta) {
  const results = [];

  for (const meta of accountMeta) {
    const table = sanitizeTableName(meta.tableName);
    const exists = await client.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        ) AS exists
      `,
      [table]
    );

    if (!exists.rows[0]?.exists) {
      continue;
    }

    const q = await client.query(
      `
        SELECT
          uuid::text AS uuid,
          transaction_date::text AS transaction_date,
          dockey::text AS dockey,
          entriesid::text AS entriesid,
          account_currency_amount::text AS account_currency_amount,
          nominal_amount::text AS nominal_amount,
          nominal_currency_uuid::text AS nominal_currency_uuid,
          description,
          docnomination,
          docinformation,
          doccomment,
          docprodgroup,
          counteragent_uuid::text AS counteragent_uuid,
          counteragent_account_number,
          project_uuid::text AS project_uuid,
          financial_code_uuid::text AS financial_code_uuid,
          payment_id,
          parsing_lock,
          applied_rule_id,
          processing_case,
          import_batch_id
        FROM "${table}"
      `
    );

    for (const row of q.rows) {
      const rec = {
        accountNumber: meta.accountNumber,
        currencyCode: meta.currencyCode,
        accountNoWithCurrency: `${meta.accountNumber}${meta.currencyCode}`,
        tableName: meta.tableName,
        uuid: row.uuid,
        date: normalizeDate(row.transaction_date),
        docKey: String(row.dockey || '').trim() || null,
        entriesId: String(row.entriesid || '').trim() || null,
        amountSigned: toNumber(row.account_currency_amount),
        nominalAmount: toNumber(row.nominal_amount),
        nominalCurrencyUuid: row.nominal_currency_uuid || null,
        description: row.description || null,
        docnomination: row.docnomination || null,
        docinformation: row.docinformation || null,
        additionaldescription: row.doccomment || null,
        additionalinformation: row.docinformation || null,
        operationCode: row.docprodgroup || null,
        counteragentUuid: row.counteragent_uuid || null,
        counteragentAccountNumber: row.counteragent_account_number || null,
        projectUuid: row.project_uuid || null,
        financialCodeUuid: row.financial_code_uuid || null,
        paymentId: row.payment_id || null,
        parsingLock: Boolean(row.parsing_lock),
        appliedRuleId: row.applied_rule_id,
        processingCase: row.processing_case || null,
        importBatchId: row.import_batch_id || null,
      };
      rec.txKey = transactionKey(rec.accountNumber, rec.docKey, rec.entriesId);
      results.push(rec);
    }
  }

  return results;
}

function indexByKey(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row.txKey) continue;
    if (!map.has(row.txKey)) map.set(row.txKey, []);
    map.get(row.txKey).push(row);
  }
  return map;
}

function pickFirst(arr) {
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

function amountMismatch(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return Math.abs(Number(a) - Number(b)) > 0.005;
}

function textMismatch(a, b) {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!x || !y) return false;
  return x !== y;
}

function consolidateRows(originalRows, parsedRows, dbRows) {
  const parsedByKey = indexByKey(parsedRows);
  const dbByKey = indexByKey(dbRows);

  const allKeys = new Set();
  for (const r of originalRows) allKeys.add(r.txKey);
  for (const r of parsedRows) allKeys.add(r.txKey);
  for (const r of dbRows) allKeys.add(r.txKey);

  const consolidated = [];
  const issues = [];

  for (const key of allKeys) {
    const originalList = originalRows.filter((r) => r.txKey === key);
    const parsedList = parsedByKey.get(key) || [];
    const dbList = dbByKey.get(key) || [];

    const original = pickFirst(originalList);
    const parsed = pickFirst(parsedList);
    const db = pickFirst(dbList);

    const accountNumber = original?.accountNumber || parsed?.accountNumber || db?.accountNumber || null;
    const currencyCode = original?.currencyCode || parsed?.currencyCode || db?.currencyCode || null;

    const row = {
      txKey: key,
      accountNumber,
      currencyCode,
      docKey: original?.docKey || parsed?.docKey || db?.docKey || null,
      entriesId: original?.entriesId || parsed?.entriesId || db?.entriesId || null,
      originalExists: originalList.length > 0,
      parsedExists: parsedList.length > 0,
      dbExists: dbList.length > 0,
      originalDuplicates: Math.max(0, originalList.length - 1),
      parsedDuplicates: Math.max(0, parsedList.length - 1),
      dbDuplicates: Math.max(0, dbList.length - 1),
      dateOriginal: original?.date || null,
      dateParsed: parsed?.date || null,
      dateDb: db?.date || null,
      amountOriginal: original?.amountSigned ?? null,
      amountParsed: parsed?.amount ?? null,
      amountDb: db?.amountSigned ?? null,
      descriptionOriginal: original?.description || null,
      descriptionParsed: parsed?.description || null,
      descriptionDb: db?.description || db?.docnomination || null,
      additionalInfoOriginal: original?.additionalInfo || null,
      additionalInfoDb: db?.additionalinformation || null,
      counteragentUuidParsed: parsed?.counteragentUuid || null,
      counteragentUuidDb: db?.counteragentUuid || null,
      projectUuidParsed: parsed?.projectUuid || null,
      projectUuidDb: db?.projectUuid || null,
      financialCodeUuidParsed: parsed?.financialCodeUuid || null,
      financialCodeUuidDb: db?.financialCodeUuid || null,
      counteragentAccountParsed: parsed?.counteragentAccountNumber || null,
      counteragentAccountDb: db?.counteragentAccountNumber || null,
      nominalAmountParsed: parsed?.nominalAmount ?? null,
      nominalAmountDb: db?.nominalAmount ?? null,
      paymentIdDb: db?.paymentId || null,
      parsingLockDb: db?.parsingLock ?? null,
      processingCaseDb: db?.processingCase || null,
      dbUuid: db?.uuid || null,
      sourcePriority: db ? 'db' : parsed ? 'parsed' : 'original',
      finalDate: db?.date || parsed?.date || original?.date || null,
      finalAmount: db?.amountSigned ?? parsed?.amount ?? original?.amountSigned ?? null,
      finalDescription: db?.description || db?.docnomination || parsed?.description || original?.description || null,
      finalCounteragentUuid: db?.counteragentUuid || parsed?.counteragentUuid || null,
      finalProjectUuid: db?.projectUuid || parsed?.projectUuid || null,
      finalFinancialCodeUuid: db?.financialCodeUuid || parsed?.financialCodeUuid || null,
      finalCounteragentAccount: db?.counteragentAccountNumber || parsed?.counteragentAccountNumber || original?.partnerAccountNumber || null,
      finalNominalAmount: db?.nominalAmount ?? parsed?.nominalAmount ?? null,
      finalPaymentId: db?.paymentId || null,
      auditFlags: [],
    };

    if (row.originalExists && !row.dbExists) row.auditFlags.push('missing_in_db');
    if (row.originalExists && !row.parsedExists) row.auditFlags.push('missing_in_parsed');
    if (!row.originalExists && row.dbExists) row.auditFlags.push('db_only');
    if (!row.originalExists && row.parsedExists) row.auditFlags.push('parsed_only');
    if (amountMismatch(row.amountOriginal, row.amountDb)) row.auditFlags.push('amount_original_vs_db_mismatch');
    if (amountMismatch(row.amountParsed, row.amountDb)) row.auditFlags.push('amount_parsed_vs_db_mismatch');
    if (textMismatch(row.descriptionOriginal, row.descriptionDb)) row.auditFlags.push('description_original_vs_db_mismatch');
    if (row.originalDuplicates > 0 || row.parsedDuplicates > 0 || row.dbDuplicates > 0) {
      row.auditFlags.push('duplicate_key_detected');
    }

    consolidated.push(row);

    if (row.auditFlags.length > 0) {
      issues.push({
        txKey: row.txKey,
        accountNumber: row.accountNumber,
        currencyCode: row.currencyCode,
        docKey: row.docKey,
        entriesId: row.entriesId,
        flags: row.auditFlags.join(', '),
      });
    }
  }

  return { consolidated, issues };
}

function writeOutputs(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(OUTPUT_DIR, `tbc-missing-accounts-audit-${stamp}.json`);
  const xlsxPath = path.join(OUTPUT_DIR, `tbc-missing-accounts-audit-${stamp}.xlsx`);

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

  const wb = XLSX.utils.book_new();
  const summaryRows = [
    { metric: 'original_rows', value: result.summary.originalRows },
    { metric: 'parsed_rows', value: result.summary.parsedRows },
    { metric: 'db_rows', value: result.summary.dbRows },
    { metric: 'consolidated_rows', value: result.summary.consolidatedRows },
    { metric: 'issue_rows', value: result.summary.issueRows },
    { metric: 'missing_in_db', value: result.summary.flagCounts.missing_in_db || 0 },
    { metric: 'missing_in_parsed', value: result.summary.flagCounts.missing_in_parsed || 0 },
    { metric: 'db_only', value: result.summary.flagCounts.db_only || 0 },
    { metric: 'parsed_only', value: result.summary.flagCounts.parsed_only || 0 },
    { metric: 'amount_original_vs_db_mismatch', value: result.summary.flagCounts.amount_original_vs_db_mismatch || 0 },
    { metric: 'amount_parsed_vs_db_mismatch', value: result.summary.flagCounts.amount_parsed_vs_db_mismatch || 0 },
    { metric: 'description_original_vs_db_mismatch', value: result.summary.flagCounts.description_original_vs_db_mismatch || 0 },
    { metric: 'duplicate_key_detected', value: result.summary.flagCounts.duplicate_key_detected || 0 },
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.accountStats), 'Account Stats');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.issues), 'Issues');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.consolidated), 'Consolidated');

  XLSX.writeFile(wb, xlsxPath);

  return { jsonPath, xlsxPath };
}

async function main() {
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');
  }

  const { rows: originalRows, accountMeta } = readOriginalAccountWorkbooks();
  const allowedAccounts = new Set(accountMeta.map((a) => `${a.accountNumber}${a.currencyCode}`));
  const parsedRows = readParsedWorkbook(allowedAccounts);

  const client = new Client({ connectionString });
  await client.connect();

  let dbRows;
  try {
    dbRows = await loadDbRows(client, accountMeta);
  } finally {
    await client.end();
  }

  const { consolidated, issues } = consolidateRows(originalRows, parsedRows, dbRows);

  const flagCounts = {};
  for (const row of consolidated) {
    for (const flag of row.auditFlags) {
      flagCounts[flag] = (flagCounts[flag] || 0) + 1;
    }
  }

  const accountStats = accountMeta.map((a) => {
    const accNoWithCurrency = `${a.accountNumber}${a.currencyCode}`;
    const original = originalRows.filter((r) => r.accountNoWithCurrency === accNoWithCurrency).length;
    const parsed = parsedRows.filter((r) => r.accountNoWithCurrency === accNoWithCurrency).length;
    const db = dbRows.filter((r) => r.accountNoWithCurrency === accNoWithCurrency).length;
    const keys = consolidated.filter((r) => r.accountNumber === a.accountNumber && r.currencyCode === a.currencyCode).length;
    return {
      accountNumber: a.accountNumber,
      currencyCode: a.currencyCode,
      tableName: a.tableName,
      originalRows: original,
      parsedRows: parsed,
      dbRows: db,
      consolidatedKeys: keys,
    };
  });

  const result = {
    generatedAt: new Date().toISOString(),
    sourceDir: SOURCE_DIR,
    summary: {
      originalRows: originalRows.length,
      parsedRows: parsedRows.length,
      dbRows: dbRows.length,
      consolidatedRows: consolidated.length,
      issueRows: issues.length,
      flagCounts,
    },
    accountStats,
    issues,
    consolidated,
  };

  const out = writeOutputs(result);

  console.log(
    JSON.stringify(
      {
        summary: result.summary,
        accountStats: result.accountStats,
        output: out,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
