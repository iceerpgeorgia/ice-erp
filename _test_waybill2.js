const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function test() {
  await client.connect();
  
  // Find projects with 1.1.1 payments AND waybills
  const q1 = `
    SELECT DISTINCT p.project_uuid::text
    FROM payments p
    JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    WHERE fc.code = '1.1.1'
    AND p.is_active = true
    AND p.project_uuid::text IN (
      SELECT DISTINCT project_uuid::text FROM rs_waybills_in WHERE project_uuid IS NOT NULL
    )
    LIMIT 5
  `;
  const { rows: pRows } = await client.query(q1);
  console.log('Projects with 1.1.1 payments AND waybills:', pRows.length);
  pRows.forEach(r => console.log(' -', r.project_uuid));
  
  if (pRows.length === 0) {
    console.log('No matching projects!');
    // Check if financial_codes has default_code_fc
    const q0 = `SELECT column_name FROM information_schema.columns WHERE table_name='financial_codes' AND column_name='default_code_fc'`;
    const { rows: colRows } = await client.query(q0);
    console.log('default_code_fc column exists:', colRows.length > 0);
    // Check if rs_waybills_in has rows
    const q00 = `SELECT COUNT(*) FROM rs_waybills_in`;
    const { rows: wRows } = await client.query(q00);
    console.log('rs_waybills_in rows:', wRows[0].count);
    await client.end(); return;
  }
  
  const projectUuids = pRows.map(r => r.project_uuid);
  const placeholders = projectUuids.map((_, i) => `$${i+1}`).join(',');
  
  const q2 = `
    WITH waybill_agg AS (
      SELECT w.project_uuid::text AS project_uuid,
             SUM(COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END) AS waybill_sum
      FROM rs_waybills_in w
      WHERE w.project_uuid::text IN (${placeholders})
      GROUP BY w.project_uuid
    )
    SELECT
      p.project_uuid::text,
      p.financial_code_uuid::text,
      fc.code AS fc_code,
      fc2.default_code_fc::text AS default_cost_fc,
      fc3.code AS paired_fc_code,
      COALESCE(MAX(wa.waybill_sum), 0) AS waybill_sum
    FROM payments p
    JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    LEFT JOIN financial_codes fc2 ON fc2.uuid = p.financial_code_uuid AND fc2.default_code_fc IS NOT NULL
    LEFT JOIN financial_codes fc3 ON fc3.uuid = fc2.default_code_fc
    LEFT JOIN waybill_agg wa ON wa.project_uuid = p.project_uuid::text AND fc2.uuid IS NOT NULL
    WHERE p.is_active = true AND p.project_uuid::text IN (${placeholders})
    GROUP BY p.project_uuid, p.financial_code_uuid, fc.code, fc2.default_code_fc, fc3.code
    ORDER BY p.project_uuid, fc.code
  `;
  
  const { rows } = await client.query(q2, projectUuids);
  console.log('\nRows with waybill_sum > 0 or paired_fc_code:');
  rows.filter(r => Number(r.waybill_sum) > 0 || r.paired_fc_code).forEach(r => console.log(JSON.stringify(r)));
  console.log('Total rows:', rows.length);
  
  await client.end();
}

test().catch(e => { console.error(e.message); process.exit(1); });
