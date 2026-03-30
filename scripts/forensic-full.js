const XLSX = require('xlsx');
const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();
BigInt.prototype.toJSON = function() { return Number(this); };

(async () => {
  console.log('========================================');
  console.log('  FULL FORENSIC INVESTIGATION');
  console.log('========================================\n');

  // 1. Check audit log for any job-related entries
  console.log('=== 1. AUDIT LOG - JOB RELATED ENTRIES ===');
  const auditJobs = await p.$queryRawUnsafe(`
    SELECT id::text, created_at, "table", record_id, action, user_email, changes
    FROM "AuditLog"
    WHERE "table" ILIKE '%job%' OR record_id::text ILIKE '%b2a9bd9f%' OR record_id::text ILIKE '%b3ace415%'
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log(`  Found ${auditJobs.length} job-related audit entries`);
  for (const a of auditJobs) {
    console.log(`  ${a.created_at} | ${a.table} | ${a.action} | record=${a.record_id} | user=${a.user_email}`);
    if (a.changes) console.log(`    changes: ${JSON.stringify(a.changes)}`);
  }

  // 2. Check ALL audit log tables
  console.log('\n=== 2. AUDIT LOG - ALL TABLES TRACKED ===');
  const tables = await p.$queryRawUnsafe(`
    SELECT DISTINCT "table", count(*)::int as cnt FROM "AuditLog" GROUP BY "table" ORDER BY "table"
  `);
  for (const t of tables) console.log(`  ${t.table}: ${t.cnt} entries`);

  // 3. L0002 (b2a9bd9f) - the BILLY MANAGMENT -> Deka Lisi job
  console.log('\n=== 3. L0002 (b2a9bd9f) FULL STATE ===');
  const l0002 = await p.$queryRawUnsafe(`
    SELECT j.*, b.name as brand_name 
    FROM jobs j LEFT JOIN brands b ON j.brand_uuid = b.uuid 
    WHERE j.job_uuid = 'b2a9bd9f-b174-4a02-b6b6-a5fd636d393d'
  `);
  console.log('  Job record:', JSON.stringify(l0002[0], null, 2));
  const l0002bindings = await p.$queryRawUnsafe(`
    SELECT jp.project_uuid, pr.project_name 
    FROM job_projects jp JOIN projects pr ON jp.project_uuid = pr.project_uuid 
    WHERE jp.job_uuid = 'b2a9bd9f-b174-4a02-b6b6-a5fd636d393d'
  `);
  console.log('  Bindings:', l0002bindings.map(b => `${b.project_name} (${b.project_uuid})`).join(', '));
  const l0002payments = await p.$queryRawUnsafe(`
    SELECT payment_id, project_uuid FROM payments WHERE job_uuid = 'b2a9bd9f-b174-4a02-b6b6-a5fd636d393d'
  `);
  console.log(`  Payments: ${l0002payments.length}`);
  for (const pay of l0002payments) {
    const proj = await p.$queryRawUnsafe(`SELECT project_name FROM projects WHERE project_uuid = $1::uuid`, pay.project_uuid);
    console.log(`    ${pay.payment_id} -> ${proj[0]?.project_name || pay.project_uuid}`);
  }

  // 4. Deka Lisi project full check
  console.log('\n=== 4. DEKA LISI PROJECT (317f801f) - FULL CHECK ===');
  const dekaLisiProj = await p.$queryRawUnsafe(`
    SELECT * FROM projects WHERE project_uuid = '317f801f-bf5e-43fc-91d4-d5978e6673a3'
  `);
  console.log('  Project:', JSON.stringify(dekaLisiProj[0], null, 2));
  
  const dekaBindings = await p.$queryRawUnsafe(`
    SELECT jp.job_uuid, j.job_name, j.is_active
    FROM job_projects jp
    JOIN jobs j ON jp.job_uuid = j.job_uuid
    WHERE jp.project_uuid = '317f801f-bf5e-43fc-91d4-d5978e6673a3'
  `);
  console.log(`  Current job bindings: ${dekaBindings.length}`);
  for (const b of dekaBindings) console.log(`    ${b.job_name} | active=${b.is_active} | ${b.job_uuid}`);

  // Jobs with legacy project_uuid pointing to Deka Lisi
  const dekaLegacy = await p.$queryRawUnsafe(`
    SELECT job_uuid, job_name, is_active FROM jobs WHERE project_uuid = '317f801f-bf5e-43fc-91d4-d5978e6673a3'
  `);
  console.log(`  Legacy project_uuid jobs: ${dekaLegacy.length}`);
  for (const j of dekaLegacy) console.log(`    ${j.job_name} | active=${j.is_active} | ${j.job_uuid}`);

  // Payments referencing Deka Lisi project
  const dekaPays = await p.$queryRawUnsafe(`
    SELECT payment_id, job_uuid FROM payments WHERE project_uuid = '317f801f-bf5e-43fc-91d4-d5978e6673a3'
  `);
  console.log(`  Payments pointing to Deka Lisi: ${dekaPays.length}`);
  for (const pay of dekaPays) {
    const job = await p.$queryRawUnsafe(`SELECT job_name, is_active FROM jobs WHERE job_uuid = $1::uuid`, pay.job_uuid);
    console.log(`    ${pay.payment_id} -> ${job[0]?.job_name || 'UNKNOWN'} (active=${job[0]?.is_active})`);
  }

  // 5. BILLY MANAGMENT project check
  console.log('\n=== 5. BILLY MANAGMENT PROJECT ===');
  const billyProj = await p.$queryRawUnsafe(`
    SELECT project_uuid, project_name FROM projects WHERE project_name ILIKE '%billy%'
  `);
  for (const bp of billyProj) {
    console.log(`  Project: ${bp.project_name} | ${bp.project_uuid}`);
    const billyBindings = await p.$queryRawUnsafe(`
      SELECT j.job_uuid, j.job_name, j.is_active FROM job_projects jp JOIN jobs j ON jp.job_uuid = j.job_uuid WHERE jp.project_uuid = $1::uuid
    `, bp.project_uuid);
    console.log(`  Current bindings: ${billyBindings.length}`);
    for (const b of billyBindings) console.log(`    ${b.job_name} | active=${b.is_active} | ${b.job_uuid}`);
  }

  // 6. L0001 (b3ace415) - the one we swapped Deka Lisi -> Kvareli
  console.log('\n=== 6. L0001 (b3ace415) - SWAPPED JOB ===');
  const l0001bindings = await p.$queryRawUnsafe(`
    SELECT jp.project_uuid, pr.project_name FROM job_projects jp JOIN projects pr ON jp.project_uuid = pr.project_uuid WHERE jp.job_uuid = 'b3ace415-638a-4c17-915d-0bfc68b0836f'
  `);
  console.log('  Current bindings:', l0001bindings.map(b => b.project_name).join(', '));
  const l0001payments = await p.$queryRawUnsafe(`
    SELECT payment_id, project_uuid FROM payments WHERE job_uuid = 'b3ace415-638a-4c17-915d-0bfc68b0836f'
  `);
  console.log(`  Payments: ${l0001payments.length}`);
  for (const pay of l0001payments) {
    const proj = await p.$queryRawUnsafe(`SELECT project_name FROM projects WHERE project_uuid = $1::uuid`, pay.project_uuid);
    console.log(`    ${pay.payment_id} -> ${proj[0]?.project_name || pay.project_uuid}`);
  }

  // 7. Excel: find BILLY MANAGMENT entries
  const wb = XLSX.readFile('jobs_2026-03-27.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  
  console.log('\n=== 7. EXCEL BILLY MANAGMENT ENTRIES ===');
  const billyExcel = rows.filter(r => r['Project Name'] && r['Project Name'].toLowerCase().includes('billy'));
  for (const r of billyExcel) {
    console.log(`  ${r['Job Name']} | ${r['Brand']} | active=${r['Status']} | job=${r['Job UUID']} | proj=${r['Project UUID']}`);
  }
  
  console.log('\n=== 8. EXCEL DEKA LISI ENTRIES (exact match) ===');
  const dekaLisiExcel = rows.filter(r => r['Project Name'] === 'Deka Lisi');
  console.log(`  Found: ${dekaLisiExcel.length}`);
  for (const r of dekaLisiExcel) {
    console.log(`  ${r['Job Name']} | ${r['Brand']} | active=${r['Status']} | job=${r['Job UUID']} | proj=${r['Project UUID']}`);
  }

  // 9. Check Kvareli Elevators in Excel
  console.log('\n=== 9. EXCEL KVARELI ELEVATORS ENTRIES ===');
  const kvareliExcel = rows.filter(r => r['Project Name'] && r['Project Name'].toLowerCase().includes('kvareli'));
  for (const r of kvareliExcel) {
    console.log(`  ${r['Job Name']} | ${r['Brand']} | active=${r['Status']} | job=${r['Job UUID']} | proj=${r['Project UUID']}`);
  }

  await p.$disconnect();
})();
