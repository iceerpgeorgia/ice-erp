const { Client } = require("pg");
require("dotenv").config({ path: ".env.vercel.local" });

const dbUrl = process.env.DATABASE_URL;
const c = new Client({ connectionString: dbUrl });

c.connect()
  .then(() => c.query("SELECT unit, unit_id, goods_name FROM rs_waybills_in_items WHERE waybill_no='0980141670'"))
  .then((r) => {
    console.log(JSON.stringify(r.rows, null, 2));
    // Also check all distinct unit+unit_id combinations
    return c.query("SELECT unit, unit_id, COUNT(*) as cnt FROM rs_waybills_in_items WHERE unit_id IN ('11','12') GROUP BY unit, unit_id ORDER BY unit_id, cnt DESC");
  })
  .then((r) => {
    console.log("\n--- unit_id 11 & 12 breakdown ---");
    console.log(JSON.stringify(r.rows, null, 2));
    c.end();
  })
  .catch((e) => { console.error(e.message); c.end(); });
