import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

const tableName = process.argv[2] ?? 'GE78BG0000000893486000_BOG_GEL';
const columnName = 'nominal_exchange_rate';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnv();
  console.log(`🔧 Backfilling ${columnName} in ${tableName}...`);

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS ${columnName} numeric`
  );

  const result = await prisma.$executeRawUnsafe(
    `UPDATE "${tableName}"
     SET ${columnName} = CASE
       WHEN nominal_amount IS NULL OR nominal_amount = 0 THEN NULL
       ELSE ABS(account_currency_amount)::numeric / ABS(nominal_amount)::numeric
     END`
  );

  console.log(`✅ Updated rows: ${result}`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
