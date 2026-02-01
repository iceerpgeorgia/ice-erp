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
  const totals = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::bigint AS total, SUM(CASE WHEN parsing_lock THEN 1 ELSE 0 END)::bigint AS locked FROM "GE78BG0000000893486000_BOG_GEL"'
  );
  const locked = await prisma.$queryRawUnsafe(
    'SELECT id, uuid, payment_id, transaction_date, parsing_lock FROM "GE78BG0000000893486000_BOG_GEL" WHERE parsing_lock = true ORDER BY transaction_date DESC LIMIT 20'
  );

  console.log('LOCK_TOTALS');
  console.log(safeStringify(totals));
  console.log('LOCKED_ROWS');
  console.log(safeStringify(locked));
}

main()
  .catch((err) => {
    console.error('[lock-check] error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
