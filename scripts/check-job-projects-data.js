const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const count = await p.$queryRawUnsafe('SELECT count(*) as cnt FROM job_projects');
  console.log('job_projects count:', count);

  const sample = await p.$queryRawUnsafe(`
    SELECT jp.job_uuid, jp.project_uuid, p.project_index
    FROM job_projects jp
    JOIN projects p ON jp.project_uuid = p.project_uuid
    LIMIT 5
  `);
  console.log('sample job_projects with project_index:', sample);

  // Check jobs with no job_projects entries
  const orphans = await p.$queryRawUnsafe(`
    SELECT count(*) as cnt
    FROM jobs j
    WHERE j.is_active = true
      AND NOT EXISTS (SELECT 1 FROM job_projects jp WHERE jp.job_uuid = j.job_uuid)
  `);
  console.log('Active jobs with NO job_projects:', orphans);

  // Check full query result sample
  const fullResult = await p.$queryRawUnsafe(`
    SELECT 
      j.job_uuid,
      j.job_name,
      (SELECT string_agg(DISTINCT p3.project_index, ', ' ORDER BY p3.project_index)
       FROM job_projects jp3
       JOIN projects p3 ON jp3.project_uuid = p3.project_uuid
       WHERE jp3.job_uuid = j.job_uuid
      ) as all_project_indices,
      (SELECT array_agg(DISTINCT jp4.project_uuid::text)
       FROM job_projects jp4
       WHERE jp4.job_uuid = j.job_uuid
      ) as project_uuids
    FROM jobs j
    WHERE j.is_active = true
    LIMIT 5
  `);
  console.log('Full query sample:', JSON.stringify(fullResult, null, 2));

  await p.$disconnect();
})();
