require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    // What FCs appear in rs_waybills_in?
    const fcs = await client.query(`
      SELECT w.financial_code_uuid, fc.code, fc.validation, fc.is_income, COUNT(*) as cnt
      FROM rs_waybills_in w
      JOIN financial_codes fc ON fc.uuid = w.financial_code_uuid
      WHERE w.financial_code_uuid IS NOT NULL
      GROUP BY w.financial_code_uuid, fc.code, fc.validation, fc.is_income
      ORDER BY cnt DESC LIMIT 20
    `);
    console.log("FCs in waybills:", JSON.stringify(fcs.rows, null, 2));

    // Check default_code_fc pairings
    const pairings = await client.query(`
      SELECT uuid, code, validation, is_income, default_code_fc,
             (SELECT code FROM financial_codes fc2 WHERE fc2.uuid = fc.default_code_fc) AS paired_code
      FROM financial_codes fc
      WHERE default_code_fc IS NOT NULL
      LIMIT 10
    `);
    console.log("\nFC pairings:", JSON.stringify(pairings.rows, null, 2));
  } catch(e) { console.error("Error:", e.message); }
  await client.end();
});
