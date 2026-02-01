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
  const columns = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'payment_id_duplicates'
     ORDER BY ordinal_position`
  );

  console.log('PAYMENT_ID_DUPLICATES_COLUMNS');
  console.log(safeStringify(columns));
}

main()
  .catch((err) => {
    console.error('[describe-payment-id-duplicates] error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
