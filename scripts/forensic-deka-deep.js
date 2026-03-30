const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();
BigInt.prototype.toJSON = function() { return Number(this); };

(async () => {
  // Check the 8 payments pointing to Deka Lisi with UNKNOWN jobs
  const dekaPays = await p.$queryRawUnsafe(`
    SELECT pay.payment_id, pay.job_uuid, pay.project_uuid, pay.counteragent_uuid,
           j.job_name, j.is_active as job_active,
           pr.project_name
    FROM payments pay
    LEFT JOIN jobs j ON pay.job_uuid = j.job_uuid
    LEFT JOIN projects pr ON pay.project_uuid = pr.project_uuid
    WHERE pay.project_uuid = '317f801f-bf5e-43fc-91d4-d5978e6673a3'
    ORDER BY pay.payment_id
  `);
  
  console.log(`=== PAYMENTS POINTING TO DEKA LISI (${dekaPays.length}) ===`);
  for (const pay of dekaPays) {
    const jobStatus = pay.job_name ? `${pay.job_name} (active=${pay.job_active})` : `ORPHANED (job_uuid=${pay.job_uuid})`;
    console.log(`  ${pay.payment_id} | job: ${jobStatus}`);
    
    // If job_uuid doesn't exist, check if it was deactivated
    if (!pay.job_name && pay.job_uuid) {
      const inactiveJob = await p.$queryRawUnsafe(
        `SELECT job_uuid, job_name, is_active FROM jobs WHERE job_uuid = $1::uuid`,
        pay.job_uuid
      );
      if (inactiveJob.length > 0) {
        console.log(`    -> Job exists but is_active=${inactiveJob[0].is_active}, name=${inactiveJob[0].job_name}`);
      } else {
        console.log(`    -> Job UUID NOT FOUND in jobs table at all!`);
      }
    }
  }

  // Now check what happened to the L0001 for Deka Lisi
  // In the Excel backup, Deka Lisi had 0 entries. So the question is:
  // was there ever a Deka Lisi binding in the Excel?
  
  // Check L0001 (b3ace415) full history
  console.log('\n=== L0001 (b3ace415) - ORIGINAL STATE ===');
  const l0001 = await p.$queryRawUnsafe(`
    SELECT j.*, b.name as brand_name FROM jobs j LEFT JOIN brands b ON j.brand_uuid = b.uuid WHERE j.job_uuid = 'b3ace415-638a-4c17-915d-0bfc68b0836f'
  `);
  console.log(`  Legacy project_uuid: ${l0001[0]?.project_uuid}`);
  if (l0001[0]?.project_uuid) {
    const legProj = await p.$queryRawUnsafe(`SELECT project_name FROM projects WHERE project_uuid = $1::uuid`, l0001[0].project_uuid);
    console.log(`  Legacy project name: ${legProj[0]?.project_name}`);
  }
  
  // Check L0002 (b2a9bd9f) legacy
  console.log('\n=== L0002 (b2a9bd9f) - ORIGINAL STATE ===');
  const l0002 = await p.$queryRawUnsafe(`
    SELECT j.*, b.name as brand_name FROM jobs j LEFT JOIN brands b ON j.brand_uuid = b.uuid WHERE j.job_uuid = 'b2a9bd9f-b174-4a02-b6b6-a5fd636d393d'
  `);
  console.log(`  Legacy project_uuid: ${l0002[0]?.project_uuid}`);
  if (l0002[0]?.project_uuid) {
    const legProj = await p.$queryRawUnsafe(`SELECT project_name FROM projects WHERE project_uuid = $1::uuid`, l0002[0].project_uuid);
    console.log(`  Legacy project name: ${legProj[0]?.project_name}`);
  }
  console.log(`  Current binding: Deka Lisi`);
  console.log(`  Payment 9514d2_7d_637763 points to: BILLY MANAGMENT`);
  console.log(`  MISMATCH: binding says Deka Lisi, payment says BILLY MANAGMENT`);

  // Check: was there another L0002 for BILLY MANAGMENT that got consolidated?
  console.log('\n=== ALL L0002 JOBS IN DB (active or not) ===');
  const allL0002 = await p.$queryRawUnsafe(`
    SELECT j.job_uuid, j.job_name, j.is_active, j.project_uuid, b.name as brand_name
    FROM jobs j LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.job_name = 'L0002' 
    ORDER BY j.is_active DESC, j.created_at
  `);
  for (const j of allL0002) {
    const proj = j.project_uuid ? await p.$queryRawUnsafe(`SELECT project_name FROM projects WHERE project_uuid = $1::uuid`, j.project_uuid) : [];
    const bindings = await p.$queryRawUnsafe(`
      SELECT pr.project_name FROM job_projects jp JOIN projects pr ON jp.project_uuid = pr.project_uuid WHERE jp.job_uuid = $1::uuid
    `, j.job_uuid);
    const payCount = await p.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM payments WHERE job_uuid = $1::uuid`, j.job_uuid);
    console.log(`  ${j.job_uuid} | ${j.brand_name} | active=${j.is_active} | legacy=${proj[0]?.project_name || 'NULL'} | bindings=${bindings.map(b=>b.project_name).join(',')||'NONE'} | payments=${payCount[0].cnt}`);
  }

  await p.$disconnect();
})();
