const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const uuid1 = 'bae4c9a4-0414-450a-b101-7fa6d78567cf';
  const uuid2 = '2b730b3e-9349-4bf8-b958-23ab09147d1a';

  // Check what these UUIDs are
  console.log('=== Checking UUID identities ===');

  // Check as job
  const j1 = await p.$queryRawUnsafe(`SELECT job_uuid, job_name FROM jobs WHERE job_uuid = $1::uuid`, uuid1);
  const j2 = await p.$queryRawUnsafe(`SELECT job_uuid, job_name FROM jobs WHERE job_uuid = $1::uuid`, uuid2);
  console.log(`${uuid1} as job:`, j1.length ? j1[0].job_name : 'NOT A JOB');
  console.log(`${uuid2} as job:`, j2.length ? j2[0].job_name : 'NOT A JOB');

  // Check as project
  const p1 = await p.$queryRawUnsafe(`SELECT project_uuid, project_name FROM projects WHERE project_uuid = $1::uuid`, uuid1);
  const p2 = await p.$queryRawUnsafe(`SELECT project_uuid, project_name FROM projects WHERE project_uuid = $1::uuid`, uuid2);
  console.log(`${uuid1} as project:`, p1.length ? p1[0].project_name : 'NOT A PROJECT');
  console.log(`${uuid2} as project:`, p2.length ? p2[0].project_name : 'NOT A PROJECT');

  // Check as insider - skip, table name differs

  // Find ALL jobs with multiple project bindings
  console.log('\n=== ALL JOBS WITH MULTIPLE PROJECT BINDINGS ===');
  const multi = await p.$queryRawUnsafe(`
    SELECT j.job_uuid, j.job_name, b.name as brand_name, j.insider_uuid,
           count(jp.project_uuid) as binding_count,
           array_agg(pr.project_name) as projects
    FROM jobs j
    JOIN job_projects jp ON j.job_uuid = jp.job_uuid
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.is_active = true
    GROUP BY j.job_uuid, j.job_name, b.name, j.insider_uuid
    HAVING count(jp.project_uuid) > 1
    ORDER BY count(jp.project_uuid) DESC
  `);
  console.log(`Found ${multi.length} jobs with multiple bindings:`);
  for (const m of multi) {
    console.log(`  ${m.job_uuid} | ${m.job_name} | ${m.brand_name} | ${Number(m.binding_count)} bindings: ${m.projects.join(', ')}`);
  }

  await p.$disconnect();
})();
