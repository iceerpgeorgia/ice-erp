require('dotenv').config({ path: '.env.vercel.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='rs_waybills_in_items' ORDER BY ordinal_position");
  console.log(r.rows.map(x => x.column_name).join(', '));
  c.end();
});
