const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  await client.query('ALTER TABLE rs_waybills_api RENAME TO rs_waybills_in_api');
  const renames = [
    ['rs_waybills_api_waybill_no_idx',        'rs_waybills_in_api_waybill_no_idx'],
    ['rs_waybills_api_counteragent_inn_idx',   'rs_waybills_in_api_counteragent_inn_idx'],
    ['rs_waybills_api_activation_time_idx',    'rs_waybills_in_api_activation_time_idx'],
    ['rs_waybills_api_counteragent_uuid_idx',  'rs_waybills_in_api_counteragent_uuid_idx'],
    ['rs_waybills_api_insider_uuid_idx',       'rs_waybills_in_api_insider_uuid_idx'],
    ['rs_waybills_api_project_uuid_idx',       'rs_waybills_in_api_project_uuid_idx'],
    ['rs_waybills_api_financial_code_uuid_idx','rs_waybills_in_api_financial_code_uuid_idx'],
  ];
  for (const [old, nw] of renames) {
    await client.query(`ALTER INDEX IF EXISTS ${old} RENAME TO ${nw}`).catch(e => console.log('skip', old, e.message));
  }
  console.log('DB rename OK');
  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
