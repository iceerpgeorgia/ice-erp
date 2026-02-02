const { Client } = require('pg');

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');
}

const tableName = 'GE65TB7856036050100002_TBC_GEL';
const columns = [
  'date',
  'paid_in',
  'paid_out',
  'balance',
  'description',
  'additional_information',
  'additional_description',
  'transaction_type',
  'document_date',
  'document_number',
  'partner_account_number',
  'partner_name',
  'partner_bank_code',
  'partner_bank_name',
  'operation_code',
  'partner_tax_code',
  'taxpayer_code',
  'taxpayer_name',
  'transaction_id',
];

const addColumnsSql = `ALTER TABLE "${tableName}" ${columns
  .map(column => `ADD COLUMN IF NOT EXISTS "${column}" TEXT`)
  .join(', ')};`;

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(addColumnsSql);
  await client.end();
  console.log('✓ Added missing TBC XML columns');
}

run().catch(error => {
  console.error('Error adding TBC XML columns:', error.message);
  process.exit(1);
});
