import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

const dateStr = process.argv[2];
if (!dateStr) {
  console.error('Usage: tsx scripts/delete-nbg-rate-date.ts YYYY-MM-DD');
  process.exit(1);
}

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
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const deleted = await prisma.nbg_exchange_rates.deleteMany({
    where: { date },
  });

  console.log(`Deleted ${deleted.count} record(s) for ${dateStr}`);
}

main()
  .catch((error) => {
    console.error('Delete failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
