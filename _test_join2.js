require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    // Check rs_waybills_in columns
    const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'rs_waybills_in' ORDER BY ordinal_position`);
    console.log("Columns:", cols.rows.map(r => r.column_name + ' (' + r.data_type + ')').join(', '));

    // Find projects that have BOTH payments under 1.1.1 AND waybills under 2.1.1.6
    const overlap = await client.query(`
      SELECT p.project_uuid::text, COUNT(DISTINCT p.payment_id) AS pmt_count
      FROM payments p
      WHERE p.financial_code_uuid = 'b59170ec-16cc-499a-9ff7-0428dcb8f727'  -- 1.1.1
        AND p.is_active = true
        AND EXISTS (SELECT 1 FROM rs_waybills_in w 
                    WHERE w.project_uuid = p.project_uuid 
                    AND w.financial_code_uuid = '6721ed04-1a15-4f3c-bbd9-d7548e0ed971')  -- 2.1.1.6
      GROUP BY p.project_uuid LIMIT 5
    `);
    console.log("\nProjects with both 1.1.1 payments AND 2.1.1.6 waybills:", JSON.stringify(overlap.rows, null, 2));
  } catch(e) { console.error("Error:", e.message); }
  await client.end();
});
