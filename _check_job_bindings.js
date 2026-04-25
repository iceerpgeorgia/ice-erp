const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres' });
(async () => {
  await c.connect();
  const r1 = await c.query(`SELECT COUNT(*) AS jobs, COUNT(DISTINCT job_uuid) AS uniq FROM jobs WHERE is_active=true`);
  console.log('active jobs:', r1.rows[0]);
  const r2 = await c.query(`SELECT COUNT(*) AS bindings, COUNT(DISTINCT project_uuid) AS distinct_projects FROM job_projects`);
  console.log('job_projects bindings:', r2.rows[0]);
  const r3 = await c.query(`SELECT COUNT(*) AS jobs_w_projects FROM jobs j WHERE j.is_active=true AND EXISTS (SELECT 1 FROM job_projects jp WHERE jp.job_uuid=j.job_uuid)`);
  console.log('active jobs with at least one project binding:', r3.rows[0]);
  const r4 = await c.query(`SELECT p.project_index, p.project_name, COUNT(jp.job_uuid) AS job_count FROM projects p LEFT JOIN job_projects jp ON jp.project_uuid=p.project_uuid LEFT JOIN jobs j ON j.job_uuid=jp.job_uuid AND j.is_active=true GROUP BY p.project_uuid, p.project_index, p.project_name ORDER BY job_count DESC LIMIT 10`);
  console.log('top projects by job count:'); console.table(r4.rows);
  const r5 = await c.query(`SELECT COUNT(*) AS empty_projects FROM projects p WHERE NOT EXISTS (SELECT 1 FROM job_projects jp JOIN jobs j ON j.job_uuid=jp.job_uuid AND j.is_active=true WHERE jp.project_uuid=p.project_uuid)`);
  console.log('projects with zero active job bindings:', r5.rows[0]);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
