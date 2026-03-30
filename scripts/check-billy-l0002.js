const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  // Check if any L0002/OTIS is still bound to BILLY MANAGMENT
  const r = await p.$queryRawUnsafe(`
    SELECT j.job_uuid, j.job_name, j.is_active, jp.project_uuid, pr.project_name
    FROM jobs j 
    JOIN job_projects jp ON j.job_uuid = jp.job_uuid 
    JOIN projects pr ON jp.project_uuid = pr.project_uuid 
    WHERE j.job_name = 'L0002' 
      AND j.brand_uuid = '57e563e9-cfc1-4f9b-885e-c9c59f076275'::uuid
      AND jp.project_uuid = '80ab22db-fae2-489c-ab02-74b62ac11c87'::uuid
  `);
  console.log('L0002/OTIS bound to BILLY MANAGMENT:', r.length ? JSON.stringify(r, null, 2) : 'NONE');

  // Also check if binding was removed by our script
  const r2 = await p.$queryRawUnsafe(`
    SELECT j.job_uuid, j.job_name, j.is_active
    FROM jobs j
    WHERE j.job_name = 'L0002' 
      AND j.brand_uuid = '57e563e9-cfc1-4f9b-885e-c9c59f076275'::uuid
      AND j.is_active = false
  `);
  console.log('\nDeactivated L0002/OTIS jobs:', r2.length ? JSON.stringify(r2, null, 2) : 'NONE');

  await p.$disconnect();
})();
