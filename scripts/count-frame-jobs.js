const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const r = await p.$queryRawUnsafe(
    "SELECT j.job_uuid, j.job_name FROM jobs j JOIN job_projects jp ON j.job_uuid = jp.job_uuid WHERE jp.project_uuid = '808bf640-8295-46a9-a083-c43472345717' AND j.is_active = true ORDER BY j.job_name"
  );
  console.log('Chkondideli Repair 21 UNITS jobs:', r.length);
  for (const x of r) console.log(' ', x.job_name, x.job_uuid);
  await p.$disconnect();
})();
