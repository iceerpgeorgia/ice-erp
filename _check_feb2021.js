require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
const sql = `
  SELECT COUNT(*) as cnt
  FROM rs_waybills_in_api
  WHERE create_date >= '2021-02-01' AND create_date < '2021-03-01'
`;
c.connect()
  .then(() => c.query(sql))
  .then(r => { console.log('Feb 2021 total:', r.rows[0].cnt); c.end(); })
  .catch(e => { console.error(e); c.end(); });
