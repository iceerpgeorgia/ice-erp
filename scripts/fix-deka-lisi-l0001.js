const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const DEKA_LISI_UUID = '317f801f-bf5e-43fc-91d4-d5978e6673a3';
  const L0002_UUID = '23a37c07-0c06-44f8-8ea5-4706625fa4af';
  const PAYMENT_ID = 'da3c68_d7_ba5fa7';

  // Get OTIS brand UUID from L0002
  const [l0002] = await p.$queryRawUnsafe(`
    SELECT brand_uuid::text, insider_uuid::text FROM jobs WHERE job_uuid = $1::uuid
  `, L0002_UUID);
  console.log('L0002 brand_uuid:', l0002.brand_uuid, 'insider_uuid:', l0002.insider_uuid);

  // Step 1: Create Deka Lisi L0001
  console.log('\n--- Step 1: Create Deka Lisi L0001 ---');
  const created = await p.$queryRawUnsafe(`
    INSERT INTO jobs (job_name, brand_uuid, insider_uuid, project_uuid, is_active, is_ff, created_at, updated_at)
    VALUES ('L0001', $1::uuid, $2, $3::uuid, true, false, NOW(), NOW())
    RETURNING job_uuid::text, job_name, id
  `, l0002.brand_uuid, l0002.insider_uuid, DEKA_LISI_UUID);
  const newL0001Uuid = created[0].job_uuid;
  console.log('Created L0001 with UUID:', newL0001Uuid);

  // Step 2: Bind L0001 to Deka Lisi
  console.log('\n--- Step 2: Bind L0001 to Deka Lisi ---');
  await p.$queryRawUnsafe(`
    INSERT INTO job_projects (job_uuid, project_uuid, created_at)
    VALUES ($1::uuid, $2::uuid, NOW())
    ON CONFLICT (job_uuid, project_uuid) DO NOTHING
  `, newL0001Uuid, DEKA_LISI_UUID);
  console.log('Bound L0001 to Deka Lisi');

  // Step 3: Remove Deka Lisi binding from L0002
  console.log('\n--- Step 3: Remove Deka Lisi binding from L0002 ---');
  const removed = await p.$queryRawUnsafe(`
    DELETE FROM job_projects 
    WHERE job_uuid = $1::uuid AND project_uuid = $2::uuid
    RETURNING *
  `, L0002_UUID, DEKA_LISI_UUID);
  console.log('Removed', removed.length, 'binding(s)');

  // Step 4: Assign payment da3c68_d7_ba5fa7 to new L0001
  console.log('\n--- Step 4: Assign payment to L0001 ---');
  const [payBefore] = await p.$queryRawUnsafe(`
    SELECT payment_id, job_uuid::text, project_uuid::text FROM payments WHERE payment_id = $1
  `, PAYMENT_ID);
  console.log('Before:', payBefore);
  
  await p.$queryRawUnsafe(`
    UPDATE payments SET job_uuid = $1::uuid WHERE payment_id = $2
  `, newL0001Uuid, PAYMENT_ID);
  
  const [payAfter] = await p.$queryRawUnsafe(`
    SELECT payment_id, job_uuid::text, project_uuid::text FROM payments WHERE payment_id = $1
  `, PAYMENT_ID);
  console.log('After:', payAfter);

  // Verify
  console.log('\n=== VERIFICATION ===');
  
  // L0001 bindings
  const l0001Bindings = await p.$queryRawUnsafe(`
    SELECT jp.project_uuid::text, pr.project_name
    FROM job_projects jp
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    WHERE jp.job_uuid = $1
  `, newL0001Uuid);
  console.log('L0001 bindings:', l0001Bindings.map(b => b.project_name).join(', '));

  // L0002 bindings
  const l0002Bindings = await p.$queryRawUnsafe(`
    SELECT jp.project_uuid::text, pr.project_name
    FROM job_projects jp
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    WHERE jp.job_uuid = $1
  `, L0002_UUID);
  console.log('L0002 bindings:', l0002Bindings.map(b => b.project_name).join(', '));

  // All Deka Lisi jobs
  const dekaJobs = await p.$queryRawUnsafe(`
    SELECT jp.job_uuid::text, j.job_name
    FROM job_projects jp
    JOIN jobs j ON jp.job_uuid = j.job_uuid
    WHERE jp.project_uuid = $1
    ORDER BY j.job_name
  `, DEKA_LISI_UUID);
  console.log('Deka Lisi jobs:', dekaJobs.map(j => `${j.job_name} (${j.job_uuid})`).join(', '));

  // Payment
  const [payFinal] = await p.$queryRawUnsafe(`
    SELECT p.payment_id, p.job_uuid::text, j.job_name, pr.project_name
    FROM payments p
    LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
    LEFT JOIN projects pr ON p.project_uuid = pr.project_uuid
    WHERE p.payment_id = $1
  `, PAYMENT_ID);
  console.log(`Payment ${PAYMENT_ID}: job=${payFinal.job_name} project=${payFinal.project_name}`);

  await p.$disconnect();
}
main();
