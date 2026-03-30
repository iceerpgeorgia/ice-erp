const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const multi = await p.$queryRawUnsafe(`
    SELECT j.job_uuid, j.job_name, count(jp.project_uuid)::int as cnt,
           array_agg(pr.project_name ORDER BY pr.project_name) as projects
    FROM jobs j
    JOIN job_projects jp ON j.job_uuid = jp.job_uuid
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    WHERE j.is_active = true
    GROUP BY j.job_uuid, j.job_name
    HAVING count(jp.project_uuid) > 1
    ORDER BY j.job_name
  `);
  console.log('Jobs with multi-bindings:', multi.length);
  for (const r of multi) console.log('  ' + r.job_name + ' -> ' + r.projects.join(', '));
  await p.$disconnect();
})();
