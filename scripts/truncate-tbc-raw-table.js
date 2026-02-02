const { Client } = require('pg');

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');
}

const tableName = 'GE65TB7856036050100002_TBC_GEL';
const sql = `TRUNCATE TABLE "${tableName}";`;

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log(`✓ Truncated ${tableName}`);
}

run().catch(error => {
  console.error('Error truncating table:', error.message);
  process.exit(1);
});
