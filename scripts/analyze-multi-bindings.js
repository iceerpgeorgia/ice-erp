const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check L0301 (2b730b3e) current bindings
  const l0301 = await p.$queryRawUnsafe(`
    SELECT jp.project_uuid, pr.project_name
    FROM job_projects jp
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    WHERE jp.job_uuid = '2b730b3e-9349-4bf8-b958-23ab09147d1a'::uuid
  `);
  console.log('L0301 (2b730b3e) bindings:', JSON.stringify(l0301, null, 2));

  // Get the project UUIDs for Chkondideli projects
  const chkProjects = await p.$queryRawUnsafe(`
    SELECT project_uuid, project_name FROM projects 
    WHERE project_name LIKE '%Chkondideli%'
    ORDER BY project_name
  `);
  console.log('\nChkondideli projects:');
  for (const pr of chkProjects) {
    console.log(`  ${pr.project_uuid} = ${pr.project_name}`);
  }

  // For each multi-bound job, show which projects
  console.log('\n=== ALL MULTI-BOUND JOBS WITH PROJECT UUIDs ===');
  const multi = await p.$queryRawUnsafe(`
    SELECT j.job_uuid, j.job_name, jp.project_uuid, pr.project_name
    FROM jobs j
    JOIN job_projects jp ON j.job_uuid = jp.job_uuid
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    WHERE j.is_active = true
    AND j.job_uuid IN (
      SELECT jp2.job_uuid FROM job_projects jp2
      GROUP BY jp2.job_uuid HAVING count(*) > 1
    )
    ORDER BY j.job_name, pr.project_name
  `);

  // Group by job
  const byJob = {};
  for (const r of multi) {
    if (!byJob[r.job_uuid]) byJob[r.job_uuid] = { name: r.job_name, bindings: [] };
    byJob[r.job_uuid].bindings.push({ uuid: r.project_uuid, name: r.project_name });
  }

  // Categorize
  const repair2 = []; // Chkondideli Repair 2 UNITS + Frame
  const repair21 = []; // Chkondideli Repair 21 UNITS + Frame
  const other = []; // everything else

  for (const [jobUuid, info] of Object.entries(byJob)) {
    const names = info.bindings.map(b => b.name).sort();
    if (names.includes('Chkondideli Repair 2 UNITS') && names.includes('Chkondideli Frame')) {
      repair2.push({ jobUuid, ...info });
    } else if (names.includes('Chkondideli Repair 21 UNITS') && names.includes('Chkondideli Frame')) {
      repair21.push({ jobUuid, ...info });
    } else {
      other.push({ jobUuid, ...info });
    }
  }

  console.log(`\nGroup A - Repair 2 UNITS + Frame (${repair2.length} jobs):`);
  for (const j of repair2) console.log(`  ${j.jobUuid} | ${j.name}`);

  console.log(`\nGroup B - Repair 21 UNITS + Frame (${repair21.length} jobs):`);
  for (const j of repair21) console.log(`  ${j.jobUuid} | ${j.name}`);

  console.log(`\nGroup C - Other multi-bindings (${other.length} jobs):`);
  for (const j of other) {
    console.log(`  ${j.jobUuid} | ${j.name} | ${j.bindings.map(b => b.name).join(' + ')}`);
  }

  await p.$disconnect();
})();
