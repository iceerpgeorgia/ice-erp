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
  const total = await prisma.$queryRawUnsafe('SELECT COUNT(*)::bigint AS total FROM "AuditLog"');
  const byTable = await prisma.$queryRawUnsafe('SELECT "table", COUNT(*)::bigint AS total FROM "AuditLog" GROUP BY "table" ORDER BY total DESC');
  const latest = await prisma.$queryRawUnsafe('SELECT id, "table", record_id, action, user_email, created_at FROM "AuditLog" ORDER BY created_at DESC LIMIT 10');

  console.log('AUDIT_LOG_TOTAL');
  console.log(safeStringify(total));
  console.log('AUDIT_LOG_BY_TABLE');
  console.log(safeStringify(byTable));
  console.log('AUDIT_LOG_LATEST_10');
  console.log(safeStringify(latest));
}

main()
  .catch((err) => {
    console.error('[audit-check] error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
