require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    // Test the exact query structure for a project we know has waybills
    const testProject = '96eaf1a3-2f7c-4af8-bc23-29814db64545';
    const result = await client.query(`
      WITH waybill_agg AS (
        SELECT w.project_uuid::text AS project_uuid,
               SUM(COALESCE(w.sum,0) / CASE WHEN w.vat=true THEN 1.18 ELSE 1.0 END) AS waybill_sum
        FROM rs_waybills_in w
        WHERE w.project_uuid = $1::uuid
        GROUP BY w.project_uuid
      )
      SELECT
        sp.project_uuid::text,
        sp.financial_code_uuid::text,
        fc.code AS fc_code,
        fc.is_income,
        fc_pair.default_cost_fc,
        cost_fc.code AS paired_fc_code,
        wa.waybill_sum,
        COALESCE(MAX(wa.waybill_sum), 0) AS agg_waybill_sum
      FROM payments sp
      JOIN financial_codes fc ON fc.uuid = sp.financial_code_uuid
      LEFT JOIN (
        SELECT uuid::text AS fc_uuid, default_code_fc::text AS default_cost_fc
        FROM financial_codes WHERE default_code_fc IS NOT NULL
      ) fc_pair ON fc_pair.fc_uuid = sp.financial_code_uuid::text
      LEFT JOIN financial_codes cost_fc ON cost_fc.uuid::text = fc_pair.default_cost_fc
      LEFT JOIN waybill_agg wa ON wa.project_uuid = sp.project_uuid::text AND fc_pair.fc_uuid IS NOT NULL
      WHERE sp.project_uuid = $1::uuid AND sp.is_active = true
      GROUP BY sp.project_uuid, sp.financial_code_uuid, fc.code, fc.is_income, fc_pair.default_cost_fc, cost_fc.code, wa.waybill_sum
      ORDER BY fc.code
    `, [testProject]);
    console.log("Query results:", JSON.stringify(result.rows, null, 2));
  } catch(e) { console.error("Error:", e.message); }
  await client.end();
});
