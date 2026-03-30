const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. Check L0002 (23a37c07) - all bindings
  console.log('=== L0002 (23a37c07) bindings ===');
  const l0002Bindings = await p.$queryRawUnsafe(`
    SELECT jp.job_uuid::text, jp.project_uuid::text, pr.project_name, j.job_name, j.is_active,
           j.brand_uuid::text, b.name as brand_name, j.project_uuid::text as legacy_project_uuid
    FROM job_projects jp
    JOIN jobs j ON jp.job_uuid = j.job_uuid
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE jp.job_uuid = '23a37c07-0c06-44f8-8ea5-4706625fa4af'
  `);
  for (const b of l0002Bindings) {
    console.log(`  Project: ${b.project_name} | project_uuid: ${b.project_uuid}`);
  }
  if (l0002Bindings.length > 0) {
    console.log(`  Brand: ${l0002Bindings[0].brand_name} | Legacy project_uuid: ${l0002Bindings[0].legacy_project_uuid}`);
  }

  // 2. Check all Deka Lisi jobs (active & inactive)
  console.log('\n=== All jobs bound to Deka Lisi (317f801f) ===');
  const dekaJobs = await p.$queryRawUnsafe(`
    SELECT jp.job_uuid::text, j.job_name, j.is_active, j.created_at
    FROM job_projects jp
    JOIN jobs j ON jp.job_uuid = j.job_uuid
    WHERE jp.project_uuid = '317f801f-bf5e-43fc-91d4-d5978e6673a3'
    ORDER BY j.job_name
  `);
  for (const j of dekaJobs) {
    console.log(`  ${j.job_name} | ${j.job_uuid} | ${j.is_active ? 'ACTIVE' : 'INACTIVE'} | Created: ${j.created_at}`);
  }
  if (dekaJobs.length === 0) console.log('  NONE');

  // 3. Check all BK Dzotsi STR jobs
  console.log('\n=== All jobs bound to BK DZOTSI STR ===');
  const bkJobs = await p.$queryRawUnsafe(`
    SELECT jp.job_uuid::text, j.job_name, j.is_active, jp.project_uuid::text, pr.project_name
    FROM job_projects jp
    JOIN jobs j ON jp.job_uuid = j.job_uuid
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    WHERE pr.project_name ILIKE '%dzotsi%'
    ORDER BY j.job_name
  `);
  for (const j of bkJobs) {
    console.log(`  ${j.job_name} | ${j.job_uuid} | ${j.is_active ? 'ACTIVE' : 'INACTIVE'}`);
  }

  // 4. Check orphaned payment db4c34_ba_45523f
  console.log('\n=== Payment db4c34_ba_45523f ===');
  const payment = await p.$queryRawUnsafe(`
    SELECT p.payment_id, p.job_uuid::text, p.project_uuid::text, 
           pr.project_name, j.job_name, j.is_active as job_active
    FROM payments p
    LEFT JOIN projects pr ON p.project_uuid = pr.project_uuid
    LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
    WHERE p.payment_id = 'db4c34_ba_45523f'
  `);
  for (const pay of payment) {
    console.log(`  payment_id: ${pay.payment_id}`);
    console.log(`  project: ${pay.project_name} (${pay.project_uuid})`);
    console.log(`  job: ${pay.job_name || 'NULL'} (${pay.job_uuid || 'NULL'})`);
    console.log(`  job_active: ${pay.job_active}`);
  }
  if (payment.length === 0) console.log('  NOT FOUND');

  // 5. Look for any L0001 job that could be for Deka Lisi (check legacy project_uuid)
  console.log('\n=== L0001 jobs with Deka Lisi legacy project_uuid ===');
  const l0001Deka = await p.$queryRawUnsafe(`
    SELECT j.job_uuid::text, j.job_name, j.is_active, j.project_uuid::text as legacy_project,
           j.brand_uuid::text, b.name as brand_name, j.created_at
    FROM jobs j
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.job_name = 'L0001'
    AND j.project_uuid = '317f801f-bf5e-43fc-91d4-d5978e6673a3'
  `);
  for (const j of l0001Deka) {
    console.log(`  ${j.job_uuid} | ${j.is_active ? 'ACTIVE' : 'INACTIVE'} | Brand: ${j.brand_name} | Created: ${j.created_at}`);
    // Check bindings
    const bindings = await p.$queryRawUnsafe(`
      SELECT jp.project_uuid::text, pr.project_name
      FROM job_projects jp
      JOIN projects pr ON jp.project_uuid = pr.project_uuid
      WHERE jp.job_uuid = $1
    `, j.job_uuid);
    console.log(`  Bindings: ${bindings.length === 0 ? 'NONE' : bindings.map(b => b.project_name).join(', ')}`);
  }
  if (l0001Deka.length === 0) {
    console.log('  NONE found with legacy project_uuid = Deka Lisi');
    // Try broader search - any inactive L0001 that might have been Deka Lisi
    console.log('\n=== All INACTIVE L0001 jobs ===');
    const inactiveL0001 = await p.$queryRawUnsafe(`
      SELECT j.job_uuid::text, j.job_name, j.project_uuid::text as legacy_project,
             b.name as brand_name, j.created_at,
             pr.project_name as legacy_project_name
      FROM jobs j
      LEFT JOIN brands b ON j.brand_uuid = b.uuid
      LEFT JOIN projects pr ON j.project_uuid = pr.project_uuid
      WHERE j.job_name = 'L0001' AND j.is_active = false
    `);
    for (const j of inactiveL0001) {
      console.log(`  ${j.job_uuid} | Brand: ${j.brand_name} | Legacy: ${j.legacy_project_name} | Created: ${j.created_at}`);
    }
    if (inactiveL0001.length === 0) console.log('  No inactive L0001 found');
  }

  // 6. Check all payments for Deka Lisi project
  console.log('\n=== All Deka Lisi payments ===');
  const dekaPayments = await p.$queryRawUnsafe(`
    SELECT p.payment_id, p.job_uuid::text, j.job_name
    FROM payments p
    LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
    WHERE p.project_uuid = '317f801f-bf5e-43fc-91d4-d5978e6673a3'
    ORDER BY p.payment_id
  `);
  for (const pay of dekaPayments) {
    console.log(`  ${pay.payment_id} | job: ${pay.job_name || 'NULL'} (${pay.job_uuid || 'NULL'})`);
  }

  // 7. Check L0002 (23a37c07) created_at and history
  console.log('\n=== L0002 (23a37c07) full details ===');
  const l0002Full = await p.$queryRawUnsafe(`
    SELECT j.*, b.name as brand_name
    FROM jobs j
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.job_uuid = '23a37c07-0c06-44f8-8ea5-4706625fa4af'
  `);
  if (l0002Full.length > 0) {
    const j = l0002Full[0];
    console.log(`  job_name: ${j.job_name}`);
    console.log(`  brand: ${j.brand_name}`);
    console.log(`  is_active: ${j.is_active}`);
    console.log(`  legacy_project_uuid: ${j.project_uuid}`);
    console.log(`  created_at: ${j.created_at}`);
    console.log(`  updated_at: ${j.updated_at}`);
  }

  await p.$disconnect();
}
main();
