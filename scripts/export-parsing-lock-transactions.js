const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const name = line.slice(0, idx).replace(/\0/g, '').trim();
    let value = line.slice(idx + 1).trim();
    if (!name) continue;
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}

if (process.env.DIRECT_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL;
}

const prisma = new PrismaClient();

const TABLES = [
  { name: 'GE78BG0000000893486000_BOG_GEL', bank: 'BOG' },
  { name: 'GE65TB7856036050100002_TBC_GEL', bank: 'TBC' },
];

const extractPaymentID = (docInformation) => {
  if (!docInformation) return null;
  const text = String(docInformation).trim();

  let match = text.match(/payment[_\s]*id[:\s]*(\w+)/i);
  if (match) return match[1];

  match = text.match(/^id[:\s]+(\w+)/i);
  if (match) return match[1];

  match = text.match(/[#№](\w+)/);
  if (match) return match[1];

  match = text.match(/NP_[A-Fa-f0-9]{6}_NJ_[A-Fa-f0-9]{6}_PRL\d{6}/);
  if (match) return match[0];

  if (/^[A-Z0-9-_]+$/i.test(text) && text.length >= 5 && text.length <= 50) {
    return text;
  }

  return null;
};

const normalizeId = (value) => (value == null ? '' : String(value).trim());
const normalizeCompare = (value) => normalizeId(value).toLowerCase();

async function loadRows(tableName, bank) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      '${bank}' AS bank,
      '${tableName}' AS source_table,
      t.id,
      t.uuid,
      t.raw_record_uuid,
      t.transaction_date,
      t.description,
      t.account_currency_amount,
      t.account_currency_uuid,
      t.nominal_amount,
      t.nominal_currency_uuid,
      t.payment_id,
      t.parsing_lock,
      t.processing_case,
      t.dockey,
      t.entriesid,
      t.docinformation,
      t.docnomination,
      t.doccomment,
      t.entrycomment,
      t.docsendername,
      t.docbenefname,
      t.docsenderinn,
      t.docbenefinn,
      t.docsenderacctno,
      t.docbenefacctno,
      t.doccoracct,
      t.doccorbankname,
      ca.counteragent AS counteragent_name,
      ca.identification_number AS counteragent_inn,
      proj.project_index,
      proj.project_name,
      fc.validation AS financial_code,
      fc.code AS financial_code_code,
      curr.code AS nominal_currency_code,
      acccurr.code AS account_currency_code
    FROM "${tableName}" t
    LEFT JOIN counteragents ca ON t.counteragent_uuid = ca.counteragent_uuid
    LEFT JOIN projects proj ON t.project_uuid = proj.project_uuid
    LEFT JOIN financial_codes fc ON t.financial_code_uuid = fc.uuid
    LEFT JOIN currencies curr ON t.nominal_currency_uuid = curr.uuid
    LEFT JOIN currencies acccurr ON t.account_currency_uuid = acccurr.uuid
    WHERE t.parsing_lock = true
    ORDER BY t.transaction_date DESC, t.id DESC
  `);

  return rows.map((row) => {
    const rawText = row.docinformation || row.description || row.docnomination || '';
    const extracted = extractPaymentID(rawText);
    const currentPaymentId = normalizeId(row.payment_id);
    const differs = extracted ? normalizeCompare(extracted) !== normalizeCompare(currentPaymentId) : false;

    const output = {
      ...row,
      raw_payment_id_extracted: extracted,
      payment_id_differs_from_raw: differs,
    };

    Object.keys(output).forEach((key) => {
      if (typeof output[key] === 'bigint') output[key] = output[key].toString();
      if (output[key] instanceof Date) output[key] = output[key].toISOString();
    });

    return output;
  });
}

async function main() {
  const allRows = [];
  for (const table of TABLES) {
    const rows = await loadRows(table.name, table.bank);
    allRows.push(...rows);
  }

  const worksheet = XLSX.utils.json_to_sheet(allRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'parsing-lock');

  const outDir = path.join(repoRoot, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `parsing-lock-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);
  XLSX.writeFile(workbook, outPath);

  console.log('Wrote:', outPath);
  console.log('Row count:', allRows.length);
}

main()
  .catch((err) => {
    console.error('[export-parsing-lock-transactions] error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
