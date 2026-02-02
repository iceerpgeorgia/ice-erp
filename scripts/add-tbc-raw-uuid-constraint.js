const { Client } = require('pg');

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');
}

const tableName = 'GE65TB7856036050100002_TBC_GEL';
const constraintName = 'ge65tb7856036050100002_tbc_gel_uuid_key';
const sql = `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" UNIQUE (uuid);`;

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('✓ Added unique constraint on uuid');
}

run().catch(error => {
  console.error('Error adding uuid constraint:', error.message);
  process.exit(1);
});
