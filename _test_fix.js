require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    // Simulate the fixed waybill_agg + fc_pair join
    const result = await client.query(`
      WITH waybill_agg AS (
        SELECT
          w.project_uuid::text AS project_uuid,
          SUM(COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END) AS waybill_sum
        FROM rs_waybills_in w
        WHERE w.project_uuid IN (
          SELECT DISTINCT project_uuid FROM payments
          WHERE financial_code_uuid = 'b59170ec-16cc-499a-9ff7-0428dcb8f727'
            AND is_active = true
        )
        GROUP BY w.project_uuid
      )
      SELECT
        p.project_uuid::text,
        p.financial_code_uuid::text AS fc_uuid,
        fc.code AS fc_code,
        fc_pair.default_cost_fc,
        wa.waybill_sum
      FROM payments p
      JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
      LEFT JOIN (
        SELECT uuid::text AS fc_uuid, default_code_fc::text AS default_cost_fc
        FROM financial_codes WHERE default_code_fc IS NOT NULL
      ) fc_pair ON fc_pair.fc_uuid = p.financial_code_uuid::text
      LEFT JOIN waybill_agg wa
        ON wa.project_uuid = p.project_uuid::text
       AND fc_pair.fc_uuid IS NOT NULL
      WHERE p.financial_code_uuid = 'b59170ec-16cc-499a-9ff7-0428dcb8f727'
        AND p.is_active = true
        AND wa.waybill_sum IS NOT NULL
      GROUP BY p.project_uuid, p.financial_code_uuid, fc.code, fc_pair.default_cost_fc, wa.waybill_sum
      LIMIT 10
    `);
    console.log("Results with waybill_sum:", JSON.stringify(result.rows, null, 2));
    console.log("Rows returned:", result.rows.length);
  } catch(e) { console.error("Error:", e.message); }
  await client.end();
});
