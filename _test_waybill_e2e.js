// Test the full projects-report query logic to verify waybillSum and pairedFcCode in output
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function test() {
  await client.connect();
  
  // Find projects that have both 1.1.1 payments AND waybills
  const q1 = `
    SELECT DISTINCT sp.project_uuid::text
    FROM salary_payments sp
    JOIN financial_codes fc ON fc.uuid = sp.financial_code_uuid
    WHERE fc.code = '1.1.1'
    AND sp.project_uuid IN (
      SELECT DISTINCT project_uuid FROM rs_waybills_in WHERE project_uuid IS NOT NULL
    )
    LIMIT 5
  `;
  const { rows: pRows } = await client.query(q1);
  console.log('Projects with 1.1.1 payments AND waybills:', pRows.map(r => r.project_uuid));
  
  if (pRows.length === 0) {
    console.log('No matching projects found!');
    await client.end();
    return;
  }
  
  const projectUuids = pRows.map(r => r.project_uuid);
  const placeholders = projectUuids.map((_, i) => `$${i+1}`).join(',');
  
  // Run simplified version of the query (just the waybill-relevant parts)
  const q2 = `
    WITH waybill_agg AS (
      SELECT w.project_uuid::text AS project_uuid,
             SUM(COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END) AS waybill_sum
      FROM rs_waybills_in w
      WHERE w.project_uuid::text IN (${placeholders})
      GROUP BY w.project_uuid
    )
    SELECT
      sp.project_uuid::text,
      sp.financial_code_uuid::text,
      fc.code AS fc_code,
      fc.is_income,
      fc2.default_code_fc::text AS default_cost_fc,
      fc3.code AS paired_fc_code,
      COALESCE(MAX(wa.waybill_sum), 0) AS waybill_sum
    FROM salary_payments sp
    JOIN financial_codes fc ON fc.uuid = sp.financial_code_uuid
    LEFT JOIN financial_codes fc2 ON fc2.uuid = sp.financial_code_uuid AND fc2.default_code_fc IS NOT NULL
    LEFT JOIN financial_codes fc3 ON fc3.uuid = fc2.default_code_fc
    LEFT JOIN waybill_agg wa ON wa.project_uuid = sp.project_uuid::text AND fc2.uuid IS NOT NULL
    WHERE sp.project_uuid::text IN (${placeholders})
    GROUP BY sp.project_uuid, sp.financial_code_uuid, fc.code, fc.is_income, fc2.default_code_fc, fc3.code
    ORDER BY sp.project_uuid, fc.code
  `;
  
  const { rows } = await client.query(q2, projectUuids);
  console.log('\n=== Query results (waybill-relevant columns) ===');
  for (const row of rows) {
    if (row.waybill_sum > 0 || row.paired_fc_code) {
      console.log(JSON.stringify(row));
    }
  }
  console.log('\nAll rows with non-zero waybill_sum or pairedFcCode:', rows.filter(r => Number(r.waybill_sum) > 0 || r.paired_fc_code).length);
  console.log('Total rows:', rows.length);
  
  await client.end();
}

test().catch(e => { console.error(e); process.exit(1); });
