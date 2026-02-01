import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

const tableName = process.argv[2] ?? 'GE78BG0000000893486000_BOG_GEL';

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

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS parsing_lock BOOLEAN DEFAULT FALSE`
  );

  console.log(`Added parsing_lock column to ${tableName}`);
}

main()
  .catch((error) => {
    console.error('Add parsing_lock failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
