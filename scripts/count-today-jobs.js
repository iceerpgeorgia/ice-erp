const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check all L0001 jobs and their bindings
  const rows = await p.$queryRawUnsafe(`
    SELECT j.job_name, j.job_uuid::text, j.is_active, j.created_at,
           jp.project_uuid::text, pr.project_name,
           b.name as brand_name
    FROM jobs j
    LEFT JOIN job_projects jp ON j.job_uuid = jp.job_uuid
    LEFT JOIN projects pr ON jp.project_uuid = pr.project_uuid
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.job_name = 'L0001'
    ORDER BY j.is_active DESC, pr.project_name
  `);
  
  console.log('=== All L0001 jobs ===');
  for (const r of rows) {
    console.log(`  ${r.job_name} | ${r.job_uuid} | ${r.is_active ? 'ACTIVE' : 'INACTIVE'} | Brand: ${r.brand_name} | Project: ${r.project_name || 'NONE'} | Created: ${r.created_at}`);
  }

  // Check Deka Lisi bindings specifically
  const deka = await p.$queryRawUnsafe(`
    SELECT jp.job_uuid::text, j.job_name, j.is_active, pr.project_name
    FROM job_projects jp
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    JOIN jobs j ON jp.job_uuid = j.job_uuid
    WHERE pr.project_name ILIKE '%deka lisi%'
  `);
  console.log('\n=== Deka Lisi bindings ===');
  console.log(deka.length === 0 ? '  NONE' : deka);

  // Check payments pointing to Deka Lisi
  const dekaPayments = await p.$queryRawUnsafe(`
    SELECT count(*) as cnt FROM payments 
    WHERE project_uuid = '317f801f-bf5e-43fc-91d4-d5978e6673a3'
  `);
  console.log('\n=== Deka Lisi payments ===');
  console.log('  Total:', Number(dekaPayments[0].cnt));

  await p.$disconnect();
}
main();
