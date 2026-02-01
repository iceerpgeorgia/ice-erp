import fs from 'fs';
import path from 'path';
import { getSupabaseClient } from '../lib/bank-import/db-utils';

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

const tableName = process.argv[2] ?? 'GE78BG0000000893486000_BOG_GEL';

async function main() {
  loadEnv();
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) throw error;

  const row = data?.[0] ?? {};
  console.log(`Columns in ${tableName}:`);
  console.log(Object.keys(row).sort().join(', '));
}

main().catch((error) => {
  console.error('❌ Inspect failed:', error);
  process.exit(1);
});
