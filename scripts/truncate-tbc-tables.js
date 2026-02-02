const { Client } = require('pg');

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');
}

const rawTable = 'tbc_gel_raw_6050100002';
const deconsolidatedTable = 'GE65TB7856036050100002_TBC_GEL';

const sql = `TRUNCATE TABLE "${rawTable}"; TRUNCATE TABLE "${deconsolidatedTable}";`;

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('✓ Truncated TBC raw and deconsolidated tables');
}

run().catch(error => {
  console.error('Error truncating TBC tables:', error.message);
  process.exit(1);
});
