require('dotenv/config');

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Client } = require('pg');
const { v5: uuidv5 } = require('uuid');

const SOURCE_DIR = path.resolve(process.cwd(), 'TBC Missing Accounts');
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

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
  'ოპ. კოდი': 'operationCode',
  'დამატებითი დანიშნულება': 'additionalDescription',
  'ტრანზაქციის ID': 'transactionId',
  'Record_ID': 'recordId',
};

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const fileArg = argv.find((a) => a.startsWith('--file='));
  const batchArg = argv.find((a) => a.startsWith('--batch-id='));
  const fileName = fileArg ? fileArg.slice('--file='.length).trim() : null;
  const batchId = batchArg ? batchArg.slice('--batch-id='.length).trim() : null;
  return { apply, fileName, batchId };
}

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
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d && d.y && d.m && d.d) {
      const mm = String(d.m).padStart(2, '0');
      const dd = String(d.d).padStart(2, '0');
      return `${d.y}-${mm}-${dd}`;
    }
  }

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

  return null;
}

function parseAccountCurrencyFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename)).trim();
  const m = base.match(/^(GE[0-9A-Z]+)([A-Z]{3})$/i);
  if (!m) return null;
  const accountNumber = m[1].toUpperCase();
  const currencyCode = m[2].toUpperCase();
  return {
    accountNumber,
    currencyCode,
    accountNoWithCurrency: `${accountNumber}${currencyCode}`,
    tableName: `${accountNumber}_TBC_${currencyCode}`,
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

function readSourceRows(fileNameFilter) {
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.toLowerCase().endsWith('.xlsx') && f !== 'Parsed data.xlsx')
    .filter((f) => !fileNameFilter || f.toLowerCase() === fileNameFilter.toLowerCase())
    .sort();

  const rows = [];
  const metas = [];

  for (const file of files) {
    const meta = parseAccountCurrencyFromFilename(file);
    if (!meta) continue;

    const wb = XLSX.readFile(path.join(SOURCE_DIR, file), { raw: false, defval: '' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    const headers = (matrix[0] || []).map((h) => String(h || '').trim());

    let count = 0;
    for (let i = 1; i < matrix.length; i += 1) {
      const row = matrix[i];
      if (!row || row.every((c) => String(c || '').trim() === '')) continue;

      const mapped = mapRowByHeaders(row, headers, HEADER_TO_KEY);
      const docKey = String(mapped.transactionId || '').trim();
      const entriesId = String(mapped.documentNumber || '').trim();
      if (!docKey || !entriesId) continue;

      const paidIn = toNumber(mapped.paidIn);
      const paidOut = toNumber(mapped.paidOut);
      const amountSigned = (paidIn || 0) - (paidOut || 0);
      const txDate = normalizeDate(mapped.date);
      if (!txDate) continue;

      rows.push({
        ...meta,
        sourceFile: file,
        sourceRow: i + 1,
        docKey,
        entriesId,
        transactionDate: txDate,
        documentDate: normalizeDate(mapped.documentDate),
        amountSigned,
        paidIn,
        paidOut,
        balance: toNumber(mapped.balance),
        description: String(mapped.description || '').trim() || null,
        additionalInfo: String(mapped.additionalInfo || '').trim() || null,
        additionalDescription: String(mapped.additionalDescription || '').trim() || null,
        operationCode: String(mapped.operationCode || '').trim() || null,
        partnerAccountNumber: String(mapped.partnerAccountNumber || '').trim() || null,
        partnerName: String(mapped.partnerName || '').trim() || null,
        partnerTaxCode: String(mapped.partnerTaxCode || '').trim() || null,
        recordId: String(mapped.recordId || '').trim() || null,
      });
      count += 1;
    }

    metas.push({ ...meta, file, rowCount: count });
  }

  return { rows, metas };
}

function keyFor(docKey, entriesId) {
  return `${String(docKey || '').trim()}||${String(entriesId || '').trim()}`;
}

function pickSenderVsBenefFields(row) {
  const incoming = row.amountSigned >= 0;
  const name = row.partnerName || null;
  const inn = row.partnerTaxCode || null;
  const acct = row.partnerAccountNumber || null;

  if (incoming) {
    return {
      docsendername: name,
      docsenderinn: inn,
      docsenderacctno: acct,
      docbenefname: null,
      docbenefinn: null,
      docbenefacctno: null,
    };
  }

  return {
    docsendername: null,
    docsenderinn: null,
    docsenderacctno: null,
    docbenefname: name,
    docbenefinn: inn,
    docbenefacctno: acct,
  };
}

async function loadTableColumns(client, tableName) {
  const q = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  );
  return new Set(q.rows.map((r) => r.column_name));
}

async function loadBankAccounts(client, metas) {
  const accountNumbers = metas.map((m) => m.accountNumber);
  const q = await client.query(
    `
      SELECT
        ba.uuid::text AS bank_account_uuid,
        ba.account_number,
        ba.raw_table_name,
        c.uuid::text AS currency_uuid,
        c.code AS currency_code
      FROM bank_accounts ba
      JOIN currencies c ON c.uuid = ba.currency_uuid
      WHERE ba.account_number = ANY($1::text[])
    `,
    [accountNumbers]
  );

  const map = new Map();
  for (const r of q.rows) {
    const key = `${String(r.account_number || '').toUpperCase()}||${String(r.currency_code || '').toUpperCase()}`;
    map.set(key, {
      bankAccountUuid: r.bank_account_uuid,
      currencyUuid: r.currency_uuid,
      rawTableName: r.raw_table_name,
    });
  }
  return map;
}

async function loadExistingKeys(client, tableName) {
  const safe = sanitizeTableName(tableName);
  const q = await client.query(`SELECT dockey::text AS dockey, entriesid::text AS entriesid FROM "${safe}"`);
  const set = new Set();
  for (const row of q.rows) {
    set.add(keyFor(row.dockey, row.entriesid));
  }
  return set;
}

function buildInsertPayload(row, bankMeta, columns, importBatchId) {
  const rawUuid = uuidv5(`${row.docKey}_${row.entriesId}`, NAMESPACE);
  const nowIso = new Date().toISOString();
  const senderBenef = pickSenderVsBenefFields(row);

  const candidate = {
    uuid: rawUuid,
    import_date: nowIso,
    import_batch_id: importBatchId,
    is_processed: false,
    created_at: nowIso,
    updated_at: nowIso,
    bank_account_uuid: bankMeta.bankAccountUuid,
    raw_record_uuid: rawUuid,
    transaction_date: row.transactionDate,
    account_currency_uuid: bankMeta.currencyUuid,
    account_currency_amount: row.amountSigned,
    nominal_currency_uuid: bankMeta.currencyUuid,
    nominal_amount: row.amountSigned,
    dockey: row.docKey,
    entriesid: row.entriesId,
    entrydbamt: row.paidOut,
    entrycramt: row.paidIn,
    outbalance: row.balance,
    description: row.description,
    docnomination: row.description,
    docinformation: row.additionalInfo,
    doccomment: row.additionalDescription,
    docprodgroup: row.operationCode,
    docdate: row.documentDate,
    doccoracct: row.partnerAccountNumber,
    counteragent_account_number: row.partnerAccountNumber,
    parsing_lock: false,
    counteragent_processed: false,
    parsing_rule_processed: false,
    payment_id_processed: false,
    source_type: 'bank_xml',
    ...senderBenef,
  };

  const payload = {};
  for (const [k, v] of Object.entries(candidate)) {
    if (columns.has(k)) payload[k] = v;
  }
  return payload;
}

async function insertRow(client, tableName, payload) {
  const safe = sanitizeTableName(tableName);
  const cols = Object.keys(payload);
  const vals = Object.values(payload);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const colSql = cols.map((c) => `"${c}"`).join(', ');

  await client.query(`INSERT INTO "${safe}" (${colSql}) VALUES (${placeholders})`, vals);
}

async function main() {
  const { apply, fileName, batchId } = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL in environment');
  }

  const importBatchId = batchId || `xlsx-import-${new Date().toISOString().slice(0, 10)}`;

  const { rows, metas } = readSourceRows(fileName);
  if (rows.length === 0) {
    console.log('No source rows found to import.');
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  const summary = {
    fileFilter: fileName || null,
    importBatchId,
    totalSourceRows: rows.length,
    missingBankAccountMapping: 0,
    alreadyExisting: 0,
    readyToInsert: 0,
    inserted: 0,
    skippedErrors: 0,
  };

  const perTable = new Map();

  try {
    const bankAccountMap = await loadBankAccounts(client, metas);
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.tableName)) grouped.set(row.tableName, []);
      grouped.get(row.tableName).push(row);
    }

    for (const [tableName, tableRows] of grouped.entries()) {
      const cols = await loadTableColumns(client, tableName);
      if (!cols.size) {
        console.log(`[SKIP] ${tableName}: table not found`);
        continue;
      }

      const existing = await loadExistingKeys(client, tableName);
      const stat = {
        tableName,
        sourceRows: tableRows.length,
        alreadyExisting: 0,
        readyToInsert: 0,
        inserted: 0,
        mappingMiss: 0,
      };

      for (const row of tableRows) {
        const mappingKey = `${row.accountNumber}||${row.currencyCode}`;
        const bankMeta = bankAccountMap.get(mappingKey);
        if (!bankMeta) {
          summary.missingBankAccountMapping += 1;
          stat.mappingMiss += 1;
          continue;
        }

        const txKey = keyFor(row.docKey, row.entriesId);
        if (existing.has(txKey)) {
          summary.alreadyExisting += 1;
          stat.alreadyExisting += 1;
          continue;
        }

        const payload = buildInsertPayload(row, bankMeta, cols, importBatchId);
        summary.readyToInsert += 1;
        stat.readyToInsert += 1;

        if (apply) {
          try {
            await insertRow(client, tableName, payload);
            existing.add(txKey);
            summary.inserted += 1;
            stat.inserted += 1;
          } catch (err) {
            summary.skippedErrors += 1;
            console.error(`[ERR] ${tableName} key=${txKey} row=${row.sourceFile}:${row.sourceRow} :: ${err.message}`);
          }
        }
      }

      perTable.set(tableName, stat);
    }
  } finally {
    await client.end();
  }

  console.log('');
  console.log(apply ? 'APPLY MODE' : 'DRY-RUN MODE');
  console.log(JSON.stringify(summary, null, 2));
  for (const stat of perTable.values()) {
    console.log(
      `${stat.tableName}: source=${stat.sourceRows}, existing=${stat.alreadyExisting}, ready=${stat.readyToInsert}, inserted=${stat.inserted}, mappingMiss=${stat.mappingMiss}`
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
