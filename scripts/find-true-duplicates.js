const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  // Find: same job_name + same brand + same insider + same project_uuid but different job_uuid
  const dupes = await p.$queryRawUnsafe(`
    SELECT 
      j.job_name,
      b.name as brand_name,
      jp.project_uuid,
      pr.project_name,
      count(DISTINCT j.job_uuid) as job_count,
      array_agg(DISTINCT j.job_uuid::text) as job_uuids
    FROM jobs j
    JOIN job_projects jp ON j.job_uuid = jp.job_uuid
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.is_active = true
    GROUP BY j.job_name, j.brand_uuid, b.name, j.insider_uuid, jp.project_uuid, pr.project_name
    HAVING count(DISTINCT j.job_uuid) > 1
    ORDER BY count(DISTINCT j.job_uuid) DESC, j.job_name
  `);
  
  console.log('=== TRUE DUPLICATES: same job_name + same project but different job_uuid ===');
  console.log(`Found ${dupes.length} cases:\n`);
  
  let totalRecords = 0;
  for (const d of dupes) {
    const cnt = Number(d.job_count);
    totalRecords += cnt;
    const details = [];
    for (const uuid of d.job_uuids) {
      const r = await p.$queryRawUnsafe(`SELECT count(*) as cnt FROM payments WHERE job_uuid = $1::uuid`, uuid);
      details.push(`${uuid.slice(0,8)}: ${Number(r[0].cnt)} payments`);
    }
    console.log(`${d.job_name} | ${d.brand_name} | ${d.project_name}`);
    console.log(`  ${cnt} job records: ${details.join(', ')}`);
  }
  console.log(`\nSummary: ${dupes.length} overlapping bindings, ${totalRecords} job records involved`);
  await p.$disconnect();
})();
