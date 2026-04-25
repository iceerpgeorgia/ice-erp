const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres' });
(async () => {
  await c.connect();

  // Check columns of jobs table
  const r1 = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' ORDER BY ordinal_position`);
  console.log('jobs columns:'); console.table(r1.rows);

  // Run the actual full listing query to see if it errors
  try {
    const r2 = await c.query(`
      SELECT j.id, j.job_uuid, j.job_name, j.floors, j.weight, j.is_ff, j.factory_no, j.brand_uuid, j.is_active, j.created_at, j.updated_at, b.name as brand_name, jp.project_uuid as bound_project_uuid, p.project_index as bound_project_index, p.project_name as bound_project_name
      FROM jobs j
      INNER JOIN job_projects jp ON jp.job_uuid = j.job_uuid
      LEFT JOIN projects p ON jp.project_uuid = p.project_uuid
      LEFT JOIN brands b ON j.brand_uuid = b.uuid
      WHERE j.is_active = true
      ORDER BY j.created_at DESC, p.project_index ASC
      LIMIT 3
    `);
    console.log('query rows:', r2.rowCount, 'first:', JSON.stringify(r2.rows[0]));
  } catch(e) {
    console.error('QUERY ERROR:', e.message);
  }

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
