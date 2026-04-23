// Apply the parsing-lock-aware clear_raw_btc_on_batch_delete migration to Supabase.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SUPABASE_URL = process.env.DATABASE_URL
  || 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';

(async () => {
  const sql = fs.readFileSync(
    path.join(__dirname, 'prisma/migrations/20260423120000_clear_raw_btc_respects_parsing_lock/migration.sql'),
    'utf8'
  );
  const client = new Client({ connectionString: SUPABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    console.log('OK: clear_raw_btc_on_batch_delete updated to respect parsing_lock');
  } finally {
    await client.end();
  }
})().catch((err) => { console.error(err); process.exit(1); });
