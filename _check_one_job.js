const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres' });
(async () => {
  await c.connect();
  const r = await c.query(`SELECT job_uuid, job_name, is_active, insider_uuid FROM jobs WHERE job_uuid = $1`, ['adf8bcd4-2ad0-436b-83fb-21c4698ab643']);
  console.log('job row:', r.rows);
  const r2 = await c.query(`SELECT * FROM job_projects WHERE job_uuid = $1`, ['adf8bcd4-2ad0-436b-83fb-21c4698ab643']);
  console.log('bindings:', r2.rows);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
