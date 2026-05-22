require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  const res = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'rs_waybills_in' ORDER BY ordinal_position
  `);
  console.log(res.rows.map(r => r.column_name + ' (' + r.data_type + ')').join('\n'));
  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
