const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  // FIX 1: Restore L0002 (b2a9bd9f) binding to BILLY MANAGMENT (its correct project)
  const l0002 = 'b2a9bd9f-b174-4a02-b6b6-a5fd636d393d';
  const billyMgmt = '80ab22db-fae2-489c-ab02-74b62ac11c87';
  const dekaLisi = '317f801f-bf5e-43fc-91d4-d5978e6673a3';
  
  console.log('=== FIX 1: Restore L0002 (b2a9bd9f) -> BILLY MANAGMENT ===');
  
  // Remove wrong Deka Lisi binding
  await p.$queryRawUnsafe(
    'DELETE FROM job_projects WHERE job_uuid = $1::uuid AND project_uuid = $2::uuid',
    l0002, dekaLisi
  );
  console.log('  Removed Deka Lisi binding');
  
  // Add correct BILLY MANAGMENT binding
  await p.$queryRawUnsafe(
    'INSERT INTO job_projects (job_uuid, project_uuid) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING',
    l0002, billyMgmt
  );
  console.log('  Added BILLY MANAGMENT binding');
  
  // VERIFY
  const l0002bindings = await p.$queryRawUnsafe(`
    SELECT pr.project_name FROM job_projects jp JOIN projects pr ON jp.project_uuid = pr.project_uuid WHERE jp.job_uuid = $1::uuid
  `, l0002);
  console.log(`  L0002 now bound to: ${l0002bindings.map(b => b.project_name).join(', ')}`);

  // VERIFY BILLY MANAGMENT project
  const billyJobs = await p.$queryRawUnsafe(`
    SELECT j.job_name, j.job_uuid FROM job_projects jp JOIN jobs j ON jp.job_uuid = j.job_uuid WHERE jp.project_uuid = $1::uuid AND j.is_active = true ORDER BY j.job_name
  `, billyMgmt);
  console.log(`\n  BILLY MANAGMENT now has ${billyJobs.length} jobs: ${billyJobs.map(j => j.job_name).join(', ')}`);

  // VERIFY Deka Lisi project
  const dekaJobs = await p.$queryRawUnsafe(`
    SELECT j.job_name, j.job_uuid FROM job_projects jp JOIN jobs j ON jp.job_uuid = j.job_uuid WHERE jp.project_uuid = $1::uuid AND j.is_active = true ORDER BY j.job_name
  `, dekaLisi);
  console.log(`  Deka Lisi now has ${dekaJobs.length} jobs: ${dekaJobs.map(j => j.job_name).join(', ') || '(none)'}`);

  await p.$disconnect();
})();
