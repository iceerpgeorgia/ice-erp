const XLSX = require('xlsx');
const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const wb = XLSX.readFile('jobs_2026-03-27.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  // Find all unique project names containing "deka" or "lisi" (case insensitive)
  const projectNames = new Set(rows.map(r => r['Project Name']));
  console.log('=== All project names in Excel containing "deka" or "lisi" ===');
  for (const name of projectNames) {
    if (name && (name.toLowerCase().includes('deka') || name.toLowerCase().includes('lisi'))) {
      console.log(`  "${name}"`);
    }
  }

  // Find Deka Lisi project UUID in DB
  const dekaProject = await p.$queryRawUnsafe(`
    SELECT project_uuid, project_name FROM projects WHERE project_name ILIKE '%deka%' OR project_name ILIKE '%lisi%'
  `);
  console.log('\n=== Deka Lisi project(s) in DB ===');
  for (const r of dekaProject) console.log(`  ${r.project_name} | ${r.project_uuid}`);

  const dekaUuid = dekaProject.length > 0 ? dekaProject[0].project_uuid : null;

  // Filter Excel rows for Deka Lisi
  const dekaExcel = rows.filter(r => r['Project Name'] && r['Project Name'].toLowerCase().includes('deka'));
  console.log(`\n=== DEKA LISI IN EXCEL: ${dekaExcel.length} rows ===`);
  for (const r of dekaExcel) {
    console.log(`  ${r['Job Name']} | ${r['Brand']} | active=${r['Status']} | job=${r['Job UUID']} | proj=${r['Project UUID']}`);
  }

  // Deka Lisi jobs in DB via job_projects
  if (dekaUuid) {
    const dekaDb = await p.$queryRawUnsafe(`
      SELECT j.job_uuid, j.job_name, j.is_active, b.name as brand_name
      FROM jobs j
      JOIN job_projects jp ON j.job_uuid = jp.job_uuid
      LEFT JOIN brands b ON j.brand_uuid = b.uuid
      WHERE jp.project_uuid = $1::uuid
      ORDER BY j.job_name
    `, dekaUuid);
    console.log(`\n=== DEKA LISI IN DB (job_projects): ${dekaDb.length} rows ===`);
    for (const r of dekaDb) {
      console.log(`  ${r.job_name} | ${r.brand_name} | active=${r.is_active} | job=${r.job_uuid}`);
    }

    // Cross-reference: Excel -> Not in DB
    const dbUuids = new Set(dekaDb.map(r => r.job_uuid));
    const activeExcel = dekaExcel.filter(r => r['Status'] === 'Yes');
    console.log(`\n=== EXCEL ACTIVE DEKA JOBS MISSING FROM DB BINDINGS ===`);
    let missingCount = 0;
    for (const r of activeExcel) {
      if (!dbUuids.has(r['Job UUID'])) {
        missingCount++;
        console.log(`  MISSING: ${r['Job Name']} | ${r['Brand']} | job=${r['Job UUID']}`);
        // Check if job exists at all
        const exists = await p.$queryRawUnsafe(
          `SELECT job_uuid, job_name, is_active, project_uuid FROM jobs WHERE job_uuid = $1::uuid`,
          r['Job UUID']
        );
        if (exists.length > 0) {
          console.log(`    -> Exists: active=${exists[0].is_active}, legacy_proj=${exists[0].project_uuid}`);
          const bindings = await p.$queryRawUnsafe(`
            SELECT pr.project_name FROM job_projects jp JOIN projects pr ON jp.project_uuid = pr.project_uuid WHERE jp.job_uuid = $1::uuid
          `, r['Job UUID']);
          console.log(`    -> Current bindings: ${bindings.map(b => b.project_name).join(', ') || 'NONE'}`);
        } else {
          console.log(`    -> DOES NOT EXIST in jobs table!`);
        }
      }
    }
    if (missingCount === 0) console.log('  None missing');

    // DB -> Not in Excel
    const excelUuids = new Set(activeExcel.map(r => r['Job UUID']));
    console.log(`\n=== DB DEKA JOBS NOT IN EXCEL ===`);
    let extraCount = 0;
    for (const r of dekaDb) {
      if (!excelUuids.has(r.job_uuid)) {
        extraCount++;
        console.log(`  EXTRA: ${r.job_name} | ${r.brand_name} | active=${r.is_active} | job=${r.job_uuid}`);
      }
    }
    if (extraCount === 0) console.log('  None extra');
  }

  await p.$disconnect();
})();
