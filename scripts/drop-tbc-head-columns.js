const { Client } = require('pg');

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');
}

const tableName = 'GE65TB7856036050100002_TBC_GEL';
const columns = [
  'account_friendly_name',
  'account_type',
  'account_no',
  'account_name_georgian',
  'account_name_english',
  'currency',
  'filter_date_from',
  'filter_date_to',
  'starting_balance',
  'closing_balance',
];

const sql = `ALTER TABLE "${tableName}" ${columns
  .map(column => `DROP COLUMN IF EXISTS "${column}"`)
  .join(', ')};`;

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('✓ Dropped Head columns from TBC raw table');
}

run().catch(error => {
  console.error('Error dropping Head columns:', error.message);
  process.exit(1);
});
