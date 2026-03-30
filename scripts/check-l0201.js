const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  // Find all jobs named L0201
  const jobs = await p.$queryRawUnsafe(`
    SELECT j.job_uuid, j.job_name, j.brand_uuid, b.name as brand_name, j.insider_uuid, j.is_active
    FROM jobs j
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.job_name = 'L0201' AND j.is_active = true
    ORDER BY j.created_at
  `);
  console.log('Jobs named L0201:', JSON.stringify(jobs, null, 2));

  // Find all bindings for these jobs
  const jobUuids = jobs.map(j => j.job_uuid);
  for (const uuid of jobUuids) {
    const bindings = await p.$queryRawUnsafe(`
      SELECT jp.job_uuid, jp.project_uuid, p.project_index, p.project_name
      FROM job_projects jp
      JOIN projects p ON jp.project_uuid = p.project_uuid
      WHERE jp.job_uuid = $1::uuid
    `, uuid);
    console.log(`\nBindings for ${uuid}:`, JSON.stringify(bindings, null, 2));
  }

  await p.$disconnect();
})();
