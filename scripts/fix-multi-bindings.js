const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

const FRAME_PROJECT = '80d3eaa0-8ca0-4a0c-91e9-1a44b7bdf4b7'; // Chkondideli Frame

// Group B: 20 jobs that have Repair 21 UNITS + Frame => remove Frame binding
const groupB = [
  '539ab433-7ae4-4822-a995-3c650babeafd', // L0302
  'd55491cc-397c-4230-ab15-3861b4633a24', // L0401
  'db0a218d-a4cd-4bcc-bb4a-2ddd5e75bc03', // L0402
  'b13e0b52-4ea4-4caf-a590-fb5791582b5c', // L0501
  'a16f6612-88e9-4af4-a9bf-b8f63a7fd82d', // L0502
  '29103d04-3b52-4f9e-8f3e-5bf4a110c10c', // L0601
  '34aba3bf-ba02-4c8b-86f7-bc63ba972f4f', // L0602
  '0854406d-fecf-43a9-af63-346ab0f88193', // L0701
  '589f7c72-2f09-4a34-90ea-dbecd1a66d79', // L0702
  'b05e96f2-cb94-4fac-b475-4ad459cf79bf', // L0801
  '3af39067-49d1-4bb1-affc-7a4ba3f39885', // L0802
  'c5d52641-66ff-4e98-a265-76de09b45f95', // L0901
  '3e290771-0e66-46e7-9ddc-ff751779e9bf', // L0902
  '419d9483-759a-4ca2-bac9-7d64dde18c80', // L1001
  '1b75270b-071f-46dc-9a45-03c40916314f', // L1002
  '3148a021-af1e-4725-895c-ad43e459565c', // L1101
  '93659461-8a92-4778-8891-51375d97649c', // L1102
  'c6297117-3141-42cc-bbb0-c42c1e5240c8', // L1103
  '6606bcae-baef-420d-8e78-ef56735dde8a', // L1201
  '2bd899e4-02be-4348-8820-35630f32aafe', // L1202
];

(async () => {
  console.log('=== Removing Chkondideli Frame binding from 20 Repair 21 UNITS jobs ===');
  const r1 = await p.$queryRawUnsafe(`
    DELETE FROM job_projects 
    WHERE job_uuid = ANY($1::uuid[]) 
      AND project_uuid = $2::uuid
    RETURNING job_uuid
  `, groupB, FRAME_PROJECT);
  console.log(`Removed ${r1.length} Frame bindings from Group B`);

  // Group C: L0001 has Deka Lisi + Kvareli Elevators - remove one
  // L0001 originally had 1 binding per project. Keep Kvareli Elevators (it was its original project)
  console.log('\n=== Fixing L0001 (Deka Lisi + Kvareli Elevators) ===');
  // Check which has payments
  const l0001uuid = 'b3ace415-638a-4c17-915d-0bfc68b0836f';
  const dekaLisi = await p.$queryRawUnsafe(`
    SELECT project_uuid, project_name FROM projects WHERE project_name = 'Deka Lisi'
  `);
  const kvareli = await p.$queryRawUnsafe(`
    SELECT project_uuid, project_name FROM projects WHERE project_name = 'Kvareli Elevators'
  `);
  
  // Check payments for L0001
  const pays = await p.$queryRawUnsafe(`
    SELECT payment_id, project_uuid FROM payments WHERE job_uuid = $1::uuid
  `, l0001uuid);
  console.log(`L0001 payments: ${pays.length}`);
  for (const pay of pays) {
    const projName = pay.project_uuid === dekaLisi[0]?.project_uuid ? 'Deka Lisi' : 
                     pay.project_uuid === kvareli[0]?.project_uuid ? 'Kvareli Elevators' : pay.project_uuid;
    console.log(`  ${pay.payment_id} -> ${projName}`);
  }

  // Keep the binding that matches payments, remove the other
  const paymentProject = pays.length > 0 ? pays[0].project_uuid : null;
  if (paymentProject) {
    const removeProject = paymentProject === dekaLisi[0]?.project_uuid ? kvareli[0]?.project_uuid : dekaLisi[0]?.project_uuid;
    const removeName = paymentProject === dekaLisi[0]?.project_uuid ? 'Kvareli Elevators' : 'Deka Lisi';
    const r2 = await p.$queryRawUnsafe(`
      DELETE FROM job_projects WHERE job_uuid = $1::uuid AND project_uuid = $2::uuid RETURNING *
    `, l0001uuid, removeProject);
    console.log(`Removed ${removeName} binding from L0001 (kept ${paymentProject === dekaLisi[0]?.project_uuid ? 'Deka Lisi' : 'Kvareli Elevators'})`);
  } else {
    console.log('No payments — keeping both for manual review');
  }

  // Verify final state
  console.log('\n=== VERIFICATION ===');
  const remaining = await p.$queryRawUnsafe(`
    SELECT j.job_uuid, j.job_name, count(jp.project_uuid) as cnt,
           array_agg(pr.project_name) as projects
    FROM jobs j
    JOIN job_projects jp ON j.job_uuid = jp.job_uuid
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    WHERE j.is_active = true
    GROUP BY j.job_uuid, j.job_name
    HAVING count(jp.project_uuid) > 1
    ORDER BY j.job_name
  `);
  console.log(`Jobs still with multi-bindings: ${remaining.length}`);
  for (const r of remaining) {
    console.log(`  ${r.job_uuid} | ${r.job_name} | ${r.projects.join(', ')}`);
  }

  await p.$disconnect();
})();
