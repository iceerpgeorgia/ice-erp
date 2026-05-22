const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`
    ALTER TABLE rs_waybills_api ADD COLUMN IF NOT EXISTS project_uuid UUID;
    ALTER TABLE rs_waybills_api ADD COLUMN IF NOT EXISTS financial_code_uuid UUID;
    ALTER TABLE rs_waybills_api ADD COLUMN IF NOT EXISTS corresponding_account TEXT;
    CREATE INDEX IF NOT EXISTS rs_waybills_api_project_uuid_idx ON rs_waybills_api (project_uuid);
    CREATE INDEX IF NOT EXISTS rs_waybills_api_financial_code_uuid_idx ON rs_waybills_api (financial_code_uuid);
  `);
  console.log('User fields added to rs_waybills_api OK');
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
