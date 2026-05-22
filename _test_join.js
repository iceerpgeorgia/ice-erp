require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    // Find projects that have BOTH payments under 1.1.1 AND waybills under 2.1.1.6
    const overlap = await client.query(`
      SELECT p.project_uuid::text, COUNT(DISTINCT p.payment_id) AS pmt_count, COUNT(DISTINCT w.uuid) AS waybill_count
      FROM payments p
      JOIN rs_waybills_in w ON w.project_uuid = p.project_uuid
      WHERE p.financial_code_uuid = 'b59170ec-16cc-499a-9ff7-0428dcb8f727'  -- 1.1.1
        AND w.financial_code_uuid = '6721ed04-1a15-4f3c-bbd9-d7548e0ed971'  -- 2.1.1.6
        AND p.is_active = true
      GROUP BY p.project_uuid
      LIMIT 5
    `);
    console.log("Projects with both 1.1.1 payments AND 2.1.1.6 waybills:", JSON.stringify(overlap.rows, null, 2));

    if (overlap.rows.length > 0) {
      const testProject = overlap.rows[0].project_uuid;
      console.log("\nTest project UUID:", testProject);
      
      // Run the actual waybill_agg join
      const testQ = await client.query(`
        WITH waybill_agg AS (
          SELECT w.project_uuid::text AS project_uuid, w.financial_code_uuid::text AS financial_code_uuid,
                 SUM(COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END) AS waybill_sum
          FROM rs_waybills_in w
          WHERE w.project_uuid = $1::uuid AND w.financial_code_uuid IS NOT NULL
          GROUP BY w.project_uuid, w.financial_code_uuid
        )
        SELECT wa.*, fc_pair.fc_uuid, fc_pair.default_cost_fc
        FROM waybill_agg wa
        JOIN (
          SELECT uuid::text AS fc_uuid, default_code_fc::text AS default_cost_fc
          FROM financial_codes WHERE default_code_fc IS NOT NULL
        ) fc_pair ON fc_pair.default_cost_fc = wa.financial_code_uuid
      `, [testProject]);
      console.log("\nJoin test result:", JSON.stringify(testQ.rows, null, 2));
    }
  } catch(e) { console.error("Error:", e.message); }
  await client.end();
});
