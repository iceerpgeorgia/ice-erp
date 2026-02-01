const fs = require('fs');
const path = require('path');

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
  const dupPaymentIds = await prisma.$queryRawUnsafe(
    `WITH dup_groups AS (
       SELECT
         project_uuid,
         counteragent_uuid,
         financial_code_uuid,
         job_uuid,
         income_tax,
         currency_uuid
       FROM payments
       GROUP BY project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid
       HAVING COUNT(*) > 1
     )
     SELECT DISTINCT p.payment_id
     FROM payments p
     JOIN dup_groups d
       ON p.project_uuid IS NOT DISTINCT FROM d.project_uuid
      AND p.counteragent_uuid = d.counteragent_uuid
      AND p.financial_code_uuid = d.financial_code_uuid
      AND p.job_uuid IS NOT DISTINCT FROM d.job_uuid
      AND p.income_tax = d.income_tax
      AND p.currency_uuid = d.currency_uuid
     WHERE p.payment_id IS NOT NULL
     ORDER BY p.payment_id`
  );

  const paymentIds = dupPaymentIds.map((row) => row.payment_id);

  if (paymentIds.length === 0) {
    console.log('No duplicate payment groups found.');
    return;
  }

  const bankCounts = await prisma.$queryRawUnsafe(
    `SELECT payment_id, COUNT(*)::bigint AS cnt
     FROM "GE78BG0000000893486000_BOG_GEL"
     WHERE payment_id = ANY($1::text[])
     GROUP BY payment_id
     ORDER BY cnt DESC`,
    paymentIds
  );

  const bankIdsSet = new Set(bankCounts.map((row) => row.payment_id));
  const missingInBank = paymentIds.filter((id) => !bankIdsSet.has(id));

  console.log('DUPLICATE_PAYMENT_IDS');
  console.log(safeStringify(paymentIds));
  console.log('BANK_COUNTS');
  console.log(safeStringify(bankCounts));
  console.log('MISSING_IN_BANK');
  console.log(safeStringify(missingInBank));
}

main()
  .catch((err) => {
    console.error('[check-duplicate-payments-in-bank] error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
