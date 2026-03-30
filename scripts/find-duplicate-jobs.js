const { PrismaClient } = require('../node_modules/@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
const lines = [];
function log(s = '') { lines.push(s); console.log(s); }

(async () => {
  // Find duplicate jobs: same job_name + brand_uuid + insider_uuid but different job_uuid
  const dupes = await p.$queryRawUnsafe(`
    SELECT 
      j.job_name, 
      j.brand_uuid, 
      b.name as brand_name,
      j.insider_uuid,
      count(*) as job_count,
      array_agg(j.job_uuid::text) as job_uuids
    FROM jobs j
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.is_active = true
    GROUP BY j.job_name, j.brand_uuid, b.name, j.insider_uuid
    HAVING count(*) > 1
    ORDER BY count(*) DESC, j.job_name
  `);

  log(`Found ${dupes.length} duplicate groups:\n`);

  let totalDupeJobs = 0;
  let totalDupeBindings = 0;

  for (const d of dupes) {
    log(`--- ${d.job_name} | ${d.brand_name} | ${Number(d.job_count)} jobs ---`);
    totalDupeJobs += Number(d.job_count);

    for (const uuid of d.job_uuids) {
      const bindings = await p.$queryRawUnsafe(`
        SELECT jp.project_uuid, p.project_name
        FROM job_projects jp
        JOIN projects p ON jp.project_uuid = p.project_uuid
        WHERE jp.job_uuid = $1::uuid
      `, uuid);
      
      const payments = await p.$queryRawUnsafe(`
        SELECT count(*) as cnt FROM payments WHERE job_uuid = $1::uuid
      `, uuid);

      const projectNames = bindings.map(b => b.project_name).join(', ') || '(none)';
      const paymentCount = Number(payments[0].cnt);
      totalDupeBindings += bindings.length;
      
      log(`  ${uuid}: ${bindings.length} binding(s) [${projectNames}], ${paymentCount} payment(s)`);
    }
    log('');
  }

  log(`\nSummary: ${dupes.length} duplicate groups, ${totalDupeJobs} total job records, ${totalDupeBindings} total bindings`);
  
  fs.writeFileSync('scripts/duplicate-jobs-report.txt', lines.join('\n'), 'utf8');
  await p.$disconnect();
})();
