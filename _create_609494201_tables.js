/**
 * Creates deconsolidated raw tables for GE43BG0000000609494201 (GEL + USD) in Supabase.
 * Uses direct Postgres connection (DIRECT_DATABASE_URL from .env.local).
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const connStr = process.env.DIRECT_DATABASE_URL;
if (!connStr) {
  console.error('Missing DIRECT_DATABASE_URL in .env.local');
  process.exit(1);
}

const ACCOUNT = 'GE43BG0000000609494201';

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase (direct)');

  for (const currency of ['GEL', 'USD']) {
    const tableName = `${ACCOUNT}_BOG_${currency}`;
    const seqName   = `${tableName}_id_seq`;

    console.log(`\nChecking "${tableName}"...`);
    const { rows } = await client.query(
      `SELECT to_regclass($1::text) AS oid`,
      [`public."${tableName}"`]
    );

    if (rows[0].oid !== null) {
      console.log(`  ✓ Already exists, skipped.`);
      continue;
    }

    console.log(`  Creating...`);
    await client.query(`
      CREATE TABLE "${tableName}"
        (LIKE "GE78BG0000000893486000_BOG_GEL" INCLUDING ALL);
    `);
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS "${seqName}";
    `);
    await client.query(`
      ALTER TABLE "${tableName}"
        ALTER COLUMN id SET DEFAULT nextval('"${seqName}"');
    `);
    await client.query(`
      ALTER SEQUENCE "${seqName}"
        OWNED BY "${tableName}".id;
    `);
    console.log(`  ✓ Created "${tableName}"`);
  }

  await client.end();
  console.log('\nDone. Tables are ready for import.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
