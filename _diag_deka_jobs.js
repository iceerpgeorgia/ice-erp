const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Step 1: find Deka Lisi project
  const projs = await p.$queryRawUnsafe(
    `SELECT project_uuid::text, project_index, project_name FROM projects WHERE project_name ILIKE $1 LIMIT 10`,
    '%Deka%'
  );
  console.log('=== Projects matching "Deka" ===');
  console.log(JSON.stringify(projs, null, 2));

  if (!projs.length) { await p.$disconnect(); return; }

  for (const proj of projs) {
    const uuid = proj.project_uuid;
    console.log(`\n=== Project: ${proj.project_index} – ${proj.project_name} (${uuid}) ===`);

    // Jobs from job_projects
    const jpJobs = await p.$queryRawUnsafe(
      `SELECT 'job_projects' AS source, j.job_uuid::text, j.job_name, j.is_active
       FROM job_projects jp
       JOIN jobs j ON j.job_uuid = jp.job_uuid
       WHERE jp.project_uuid = $1::uuid
       ORDER BY j.job_name`,
      uuid
    );
    console.log('Jobs registered in job_projects:');
    console.log(JSON.stringify(jpJobs, null, 2));

    // Jobs referenced by payments
    const payJobs = await p.$queryRawUnsafe(
      `SELECT 'payments' AS source, p.payment_id, p.job_uuid::text, j.job_name, j.is_active
       FROM payments p
       LEFT JOIN jobs j ON j.job_uuid = p.job_uuid
       WHERE p.project_uuid = $1::uuid AND p.is_active = true
       ORDER BY j.job_name`,
      uuid
    );
    console.log('Jobs referenced by payments:');
    console.log(JSON.stringify(payJobs, null, 2));

    // Highlight mismatches
    const jpUuids = new Set(jpJobs.map(j => j.job_uuid));
    const mismatched = payJobs.filter(r => r.job_uuid && !jpUuids.has(r.job_uuid));
    if (mismatched.length) {
      console.log('\n!!! MISMATCHED job_uuids in payments (not in job_projects):');
      console.log(JSON.stringify(mismatched, null, 2));
    } else {
      console.log('\nAll payment job_uuids are present in job_projects.');
    }
  }

  await p.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
