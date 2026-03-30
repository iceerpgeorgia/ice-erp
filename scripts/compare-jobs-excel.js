const XLSX = require('xlsx');
const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  // Read Excel file
  const wb = XLSX.readFile('jobs_2026-03-27.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  console.log(`Excel: ${rows.length} rows, sheet: "${wb.SheetNames[0]}"`);
  console.log('---');

  // Get current DB state: all active job-project bindings
  const dbBindings = await p.$queryRawUnsafe(`
    SELECT j.job_uuid::text, j.job_name, jp.project_uuid::text, pr.project_name,
           b.name as brand_name
    FROM jobs j
    JOIN job_projects jp ON j.job_uuid = jp.job_uuid
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.is_active = true
    ORDER BY pr.project_name, j.job_name
  `);
  
  // Also get active jobs with NO bindings
  const unboundJobs = await p.$queryRawUnsafe(`
    SELECT j.job_uuid::text, j.job_name, b.name as brand_name
    FROM jobs j
    LEFT JOIN job_projects jp ON j.job_uuid = jp.job_uuid
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.is_active = true AND jp.job_uuid IS NULL
    ORDER BY j.job_name
  `);

  console.log(`DB: ${dbBindings.length} active bindings, ${unboundJobs.length} unbound active jobs`);

  // Excel: build set of (job_uuid, project_uuid) pairs
  // Only include active rows (Status = 'Yes')
  const excelActive = rows.filter(r => r['Status'] === 'Yes');
  console.log(`Excel: ${rows.length} total rows, ${excelActive.length} active`);

  const excelSet = new Set();
  const excelByKey = new Map();
  for (const row of excelActive) {
    const key = `${row['Job UUID']}|${row['Project UUID']}`;
    excelSet.add(key);
    excelByKey.set(key, row);
  }

  // DB: build set of (job_uuid, project_uuid) pairs
  const dbSet = new Set();
  const dbByKey = new Map();
  for (const row of dbBindings) {
    const key = `${row.job_uuid}|${row.project_uuid}`;
    dbSet.add(key);
    dbByKey.set(key, row);
  }

  console.log(`\nExcel unique bindings: ${excelSet.size}`);
  console.log(`DB unique bindings: ${dbSet.size}`);

  // Find differences
  let diffs = 0;

  // Bindings in Excel but not in DB
  const inExcelNotDb = [];
  for (const key of excelSet) {
    if (!dbSet.has(key)) {
      inExcelNotDb.push(excelByKey.get(key));
    }
  }
  if (inExcelNotDb.length > 0) {
    console.log(`\n❌ IN EXCEL BUT NOT IN DB (${inExcelNotDb.length}):`);
    for (const r of inExcelNotDb) {
      console.log(`   ${r['Project Name']} | ${r['Job Name']} | ${r['Brand']} | job=${r['Job UUID']} | proj=${r['Project UUID']}`);
    }
    diffs += inExcelNotDb.length;
  }

  // Bindings in DB but not in Excel
  const inDbNotExcel = [];
  for (const key of dbSet) {
    if (!excelSet.has(key)) {
      inDbNotExcel.push(dbByKey.get(key));
    }
  }
  if (inDbNotExcel.length > 0) {
    console.log(`\n❌ IN DB BUT NOT IN EXCEL (${inDbNotExcel.length}):`);
    for (const r of inDbNotExcel) {
      console.log(`   ${r.project_name} | ${r.job_name} | ${r.brand_name} | job=${r.job_uuid} | proj=${r.project_uuid}`);
    }
    diffs += inDbNotExcel.length;
  }

  if (unboundJobs.length > 0) {
    console.log(`\n⚠️  ACTIVE JOBS WITH NO BINDINGS (${unboundJobs.length}):`);
    for (const r of unboundJobs) {
      console.log(`   ${r.job_name} | ${r.brand_name} | job=${r.job_uuid}`);
    }
  }

  if (diffs === 0) {
    console.log('\n✅ Excel and DB bindings are identical!');
  } else {
    console.log(`\n${diffs} total differences found`);
  }

  await p.$disconnect();
})();
