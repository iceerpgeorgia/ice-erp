const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

const FRAME_PROJECT = '80d3eaa0-8ca0-4a0c-91e9-1a44b7bdf4b7';
const REPAIR_21 = '808bf640-8295-46a9-a083-c43472345717';

(async () => {
  // Get all 21 jobs bound to Repair 21 UNITS
  const jobs = await p.$queryRawUnsafe(
    "SELECT j.job_uuid, j.job_name FROM jobs j JOIN job_projects jp ON j.job_uuid = jp.job_uuid WHERE jp.project_uuid = $1::uuid AND j.is_active = true ORDER BY j.job_name",
    REPAIR_21
  );
  console.log(`Adding Chkondideli Frame binding to ${jobs.length} jobs...`);

  const uuids = jobs.map(j => j.job_uuid);
  const result = await p.$queryRawUnsafe(`
    INSERT INTO job_projects (job_uuid, project_uuid)
    SELECT unnest($1::uuid[]), $2::uuid
    ON CONFLICT DO NOTHING
    RETURNING job_uuid
  `, uuids, FRAME_PROJECT);
  console.log(`Added ${result.length} new Frame bindings`);

  // Verify
  const frameJobs = await p.$queryRawUnsafe(
    "SELECT j.job_name FROM jobs j JOIN job_projects jp ON j.job_uuid = jp.job_uuid WHERE jp.project_uuid = $1::uuid AND j.is_active = true ORDER BY j.job_name",
    FRAME_PROJECT
  );
  console.log(`\nChkondideli Frame now has ${frameJobs.length} jobs:`);
  for (const j of frameJobs) console.log(' ', j.job_name);

  await p.$disconnect();
})();
