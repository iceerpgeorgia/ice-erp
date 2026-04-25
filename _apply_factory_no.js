const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres' });
(async () => {
  await c.connect();
  await c.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS factory_no TEXT;`);
  console.log('OK: factory_no column added to jobs');

  // Verify the query now works
  const r = await c.query(`
    SELECT j.id, j.job_uuid, j.job_name, j.factory_no, j.is_active
    FROM jobs j
    INNER JOIN job_projects jp ON jp.job_uuid = j.job_uuid
    WHERE j.is_active = true
    LIMIT 3
  `);
  console.log('Verification - rows returned:', r.rowCount, 'first:', JSON.stringify(r.rows[0]));
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
