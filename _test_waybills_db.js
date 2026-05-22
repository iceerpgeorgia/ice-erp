require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    // Check if rs_waybills_in exists
    const exists = await client.query(`SELECT tablename FROM pg_tables WHERE tablename='rs_waybills_in'`);
    console.log("Table exists:", exists.rows.length > 0);
    if (exists.rows.length > 0) {
      const sample = await client.query(`SELECT project_uuid, financial_code_uuid, vat, "sum", activation_time FROM rs_waybills_in LIMIT 5`);
      console.log("Sample rows:", JSON.stringify(sample.rows, null, 2));
      const cnt = await client.query(`SELECT COUNT(*) FROM rs_waybills_in WHERE financial_code_uuid IS NOT NULL`);
      console.log("Rows with FC:", cnt.rows[0].count);
    }
  } catch(e) { console.error("Error:", e.message); }
  await client.end();
});
