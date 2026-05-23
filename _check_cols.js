require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', ['rs_waybills_in_api']))
  .then(r => { r.rows.forEach(row => console.log(row.column_name, '-', row.data_type)); c.end(); })
  .catch(e => { console.error(e); c.end(); });
