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
  const dupCompositeActive = await prisma.$queryRawUnsafe(
    `SELECT
       project_uuid,
       counteragent_uuid,
       financial_code_uuid,
       job_uuid,
       income_tax,
       currency_uuid,
       COUNT(*)::bigint AS cnt
     FROM payments
     WHERE is_active = true
     GROUP BY project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid
     HAVING COUNT(*) > 1
     ORDER BY cnt DESC`
  );

  console.log('DUPLICATE_COMPOSITE_ACTIVE');
  console.log(safeStringify(dupCompositeActive));
}

main()
  .catch((err) => {
    console.error('[payments-dup-check-active] error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
