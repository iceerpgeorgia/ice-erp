const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  // Simulate exactly what the route does for both projects
  const projectUuids = [
    "9f39081e-da54-4b36-8e76-a61025d8a505",  // Shartava
    "70a35471-a9c1-45d1-bfaf-a8c98abeaed7",  // Alliance Privilege
  ];
  const projectPlaceholders = projectUuids.map((_, i) => `$${i+1}::uuid`).join(', ');
  
  // Step 1: Run main query - get project_uuid keys
  const mainRows = await p.$queryRawUnsafe(`
    SELECT p.project_uuid::text, proj.project_name
    FROM payments p
    LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
    WHERE p.is_active = true
      AND p.project_uuid IN (${projectPlaceholders})
    GROUP BY p.project_uuid, proj.project_name
  `, ...projectUuids);
  
  const projectMap = new Map();
  for (const row of mainRows) {
    const key = row.project_uuid;
    if (!projectMap.has(key)) projectMap.set(key, { projectName: row.project_name, waybillSum: 0, waybillPairedFcCode: null });
  }
  
  console.log("projectMap keys:", Array.from(projectMap.keys()));
  
  // Step 2: Run waybill query exactly as in route
  const waybillQuery = `
    SELECT
      proj.project_uuid::text,
      SUM(COALESCE(w.sum, 0))::text AS waybill_sum,
      proj.financial_code_uuid::text AS project_fc_uuid,
      cost_fc.code AS paired_fc_code
    FROM projects proj
    JOIN rs_waybills_in w ON w.project_uuid = proj.project_uuid
    LEFT JOIN financial_codes fc_income ON fc_income.uuid = proj.financial_code_uuid
    LEFT JOIN financial_codes cost_fc ON cost_fc.uuid = fc_income.default_code_fc
    WHERE proj.project_uuid IN (${projectPlaceholders})
    GROUP BY proj.project_uuid, proj.financial_code_uuid, cost_fc.code, cost_fc.validation
    HAVING SUM(COALESCE(w.sum, 0)) > 0
  `;
  // NOTE: queryParams = [...projectUuids] (no insiderUuids in this test)
  const waybillRows = await p.$queryRawUnsafe(waybillQuery, ...projectUuids);
  
  console.log("\nwaybillRows returned:", waybillRows.length);
  for (const wRow of waybillRows) {
    const key = wRow.project_uuid;
    console.log("  wRow.project_uuid:", JSON.stringify(key), "typeof:", typeof key);
    console.log("  projectMap.get(key):", projectMap.has(key) ? 'FOUND' : 'NOT FOUND');
    if (projectMap.has(key)) {
      const proj = projectMap.get(key);
      proj.waybillSum = Number(wRow.waybill_sum || 0);
      proj.waybillPairedFcCode = wRow.paired_fc_code || null;
    }
  }
  
  console.log("\nFinal projectMap state:");
  for (const [k, v] of projectMap) {
    console.log(" ", v.projectName, "| waybillSum:", v.waybillSum, "| pairedFc:", v.waybillPairedFcCode);
  }
  
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
