const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function test() {
  await client.connect();
  
  const luxUuid = 'eec3d256-1657-4bbd-b4f6-e7b43062d791';
  
  // Check waybills for LUX project
  const { rows: waybills } = await client.query(`
    SELECT id, project_uuid::text, financial_code_uuid::text, vat, sum, activation_time
    FROM rs_waybills_in
    WHERE project_uuid = $1
    LIMIT 10
  `, [luxUuid]);
  console.log('=== LUX waybills ===');
  waybills.forEach(r => console.log(JSON.stringify(r)));
  
  // Check if there are payments for LUX with 1.1.1
  const { rows: payments } = await client.query(`
    SELECT p.payment_id, p.project_uuid::text, fc.code AS fc_code, fc.uuid::text AS fc_uuid,
           fc.default_code_fc::text AS default_cost_fc
    FROM payments p
    JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    WHERE p.project_uuid = $1 AND p.is_active = true AND fc.code = '1.1.1'
    LIMIT 5
  `, [luxUuid]);
  console.log('\n=== LUX 1.1.1 payments ===');
  payments.forEach(r => console.log(JSON.stringify(r)));
  
  // Test the actual waybill_agg CTE for LUX
  const { rows: agg } = await client.query(`
    WITH waybill_agg AS (
      SELECT w.project_uuid::text AS project_uuid,
             SUM(COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END) AS waybill_sum
      FROM rs_waybills_in w
      WHERE w.project_uuid = $1
      GROUP BY w.project_uuid
    )
    SELECT * FROM waybill_agg
  `, [luxUuid]);
  console.log('\n=== waybill_agg for LUX ===');
  agg.forEach(r => console.log(JSON.stringify(r)));
  
  await client.end();
}
test().catch(e => { console.error(e.message); process.exit(1); });
