const XLSX = require('xlsx');
const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const wb = XLSX.readFile('jobs_2026-03-27.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  // Filter Deka Lisi rows from Excel
  const dekaExcel = rows.filter(r => r['Project Name'] === 'Deka Lisi' && r['Status'] === 'Yes');
  console.log(`=== DEKA LISI IN EXCEL (active): ${dekaExcel.length} ===`);
  for (const r of dekaExcel) {
    console.log(`  ${r['Job Name']} | job=${r['Job UUID']} | proj=${r['Project UUID']} | brand=${r['Brand']}`);
  }

  // Deka Lisi jobs in DB (both active and inactive)
  const dekaDb = await p.$queryRawUnsafe(`
    SELECT j.job_uuid, j.job_name, j.is_active, j.brand_uuid,
           b.name as brand_name,
           jp.project_uuid, pr.project_name
    FROM jobs j
    LEFT JOIN job_projects jp ON j.job_uuid = jp.job_uuid
    LEFT JOIN projects pr ON jp.project_uuid = pr.project_uuid
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE pr.project_name = 'Deka Lisi' OR j.job_uuid IN (
      SELECT job_uuid::text FROM job_projects WHERE project_uuid = (
        SELECT project_uuid FROM projects WHERE project_name = 'Deka Lisi' LIMIT 1
      )
    )
    ORDER BY j.job_name
  `);
  console.log(`\n=== DEKA LISI IN DB (via job_projects): ${dekaDb.length} ===`);
  for (const r of dekaDb) {
    console.log(`  ${r.job_name} | job=${r.job_uuid} | active=${r.is_active} | proj=${r.project_uuid} | ${r.project_name} | brand=${r.brand_name}`);
  }

  // Also check jobs table directly for Deka Lisi project_uuid (legacy field)
  const dekaLegacy = await p.$queryRawUnsafe(`
    SELECT j.job_uuid, j.job_name, j.is_active, j.project_uuid, b.name as brand_name
    FROM jobs j
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.project_uuid = (SELECT project_uuid FROM projects WHERE project_name = 'Deka Lisi' LIMIT 1)
    ORDER BY j.job_name
  `);
  console.log(`\n=== DEKA LISI IN DB (legacy project_uuid on jobs table): ${dekaLegacy.length} ===`);
  for (const r of dekaLegacy) {
    console.log(`  ${r.job_name} | job=${r.job_uuid} | active=${r.is_active} | brand=${r.brand_name}`);
  }

  // Cross-reference: which Excel job_uuids are missing from DB bindings?
  const dbJobUuids = new Set(dekaDb.map(r => r.job_uuid));
  console.log(`\n=== EXCEL JOBS MISSING FROM DB DEKA LISI BINDINGS ===`);
  for (const r of dekaExcel) {
    if (!dbJobUuids.has(r['Job UUID'])) {
      console.log(`  MISSING: ${r['Job Name']} | job=${r['Job UUID']} | brand=${r['Brand']}`);
      // Check if this job exists at all
      const exists = await p.$queryRawUnsafe(
        `SELECT job_uuid, job_name, is_active, project_uuid FROM jobs WHERE job_uuid = $1::uuid`,
        r['Job UUID']
      );
      if (exists.length > 0) {
        console.log(`    -> Job EXISTS in DB: active=${exists[0].is_active}, legacy_project=${exists[0].project_uuid}`);
        // Check all its current bindings
        const bindings = await p.$queryRawUnsafe(`
          SELECT jp.project_uuid, pr.project_name
          FROM job_projects jp
          JOIN projects pr ON jp.project_uuid = pr.project_uuid
          WHERE jp.job_uuid = $1::uuid
        `, r['Job UUID']);
        console.log(`    -> Current bindings: ${bindings.map(b => b.project_name).join(', ') || 'NONE'}`);
      } else {
        console.log(`    -> Job DOES NOT EXIST in DB at all!`);
      }
    }
  }

  await p.$disconnect();
})();
