const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const safeStringify = (value) => JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);

async function main() {
  const dupRows = await prisma.$queryRawUnsafe(
    `WITH dup_groups AS (
       SELECT
         project_uuid,
         counteragent_uuid,
         financial_code_uuid,
         job_uuid,
         income_tax,
         currency_uuid,
         COUNT(*) AS cnt
       FROM payments
       GROUP BY project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid
       HAVING COUNT(*) > 1
     )
     SELECT
       p.id,
       p.payment_id,
       p.record_uuid,
       p.project_uuid,
       proj.project_index,
       proj.project_name,
       p.counteragent_uuid,
       ca.counteragent AS counteragent_name,
       ca.identification_number AS counteragent_id,
       p.financial_code_uuid,
       fc.validation AS financial_code,
       fc.code AS financial_code_code,
       p.job_uuid,
       j.job_name,
       p.income_tax,
       p.currency_uuid,
       curr.code AS currency_code,
       p.is_active,
       p.created_at,
       p.updated_at
     FROM payments p
     JOIN dup_groups d
       ON p.project_uuid IS NOT DISTINCT FROM d.project_uuid
      AND p.counteragent_uuid = d.counteragent_uuid
      AND p.financial_code_uuid = d.financial_code_uuid
      AND p.job_uuid IS NOT DISTINCT FROM d.job_uuid
      AND p.income_tax = d.income_tax
      AND p.currency_uuid = d.currency_uuid
     LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
     LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
     LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
     LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
     LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
     ORDER BY
       p.counteragent_uuid,
       p.financial_code_uuid,
       p.currency_uuid,
       p.project_uuid,
       p.job_uuid,
       p.income_tax,
       p.created_at DESC`
  );

  const worksheet = XLSX.utils.json_to_sheet(dupRows.map((row) => {
    const obj = { ...row };
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === 'bigint') obj[key] = obj[key].toString();
      if (obj[key] instanceof Date) obj[key] = obj[key].toISOString();
    });
    return obj;
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'payment-duplicates');

  const outPath = path.join(repoRoot, 'reports', `payment-duplicates-${new Date().toISOString().slice(0, 10)}.xlsx`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  XLSX.writeFile(workbook, outPath);

  console.log('Wrote:', outPath);
  console.log('Row count:', dupRows.length);
}

main()
  .catch((err) => {
    console.error('[export-payment-duplicates] error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
