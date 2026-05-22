require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    // For projects with 1.1.1 payments, what waybills exist?
    const result = await client.query(`
      SELECT w.financial_code_uuid::text, fc.code, fc.is_income, COUNT(*) as cnt,
             SUM(w.sum) as total_sum
      FROM rs_waybills_in w
      LEFT JOIN financial_codes fc ON fc.uuid = w.financial_code_uuid
      WHERE w.project_uuid IN (
        SELECT DISTINCT project_uuid FROM payments
        WHERE financial_code_uuid = 'b59170ec-16cc-499a-9ff7-0428dcb8f727'
          AND is_active = true
      )
      GROUP BY w.financial_code_uuid, fc.code, fc.is_income
      ORDER BY cnt DESC
      LIMIT 20
    `);
    console.log("Waybill FCs for 1.1.1-payment projects:", JSON.stringify(result.rows, null, 2));

    // How many waybills total for 1.1.1-payment projects?
    const total = await client.query(`
      SELECT COUNT(*) AS total,
             COUNT(CASE WHEN w.financial_code_uuid IS NULL THEN 1 END) AS no_fc,
             COUNT(CASE WHEN w.financial_code_uuid IS NOT NULL THEN 1 END) AS has_fc
      FROM rs_waybills_in w
      WHERE w.project_uuid IN (
        SELECT DISTINCT project_uuid FROM payments
        WHERE financial_code_uuid = 'b59170ec-16cc-499a-9ff7-0428dcb8f727'
          AND is_active = true
      )
    `);
    console.log("\nTotal waybills for 1.1.1 projects:", JSON.stringify(total.rows[0], null, 2));
  } catch(e) { console.error("Error:", e.message); }
  await client.end();
});
