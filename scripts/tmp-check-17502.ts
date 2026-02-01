import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

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
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(
    'select id, account_currency_amount, nominal_amount, nominal_currency_uuid, exchange_rate, nominal_exchange_rate from "GE78BG0000000893486000_BOG_GEL" where id=$1',
    [17502]
  );
  console.log(res.rows[0]);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
