const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  // Test with Alliance Privilege (99 waybills, FC 1.1.1)
  const testUuid = "70a35471-a9c1-45d1-bfaf-a8c98abeaed7";
  
  // Run waybill query exactly as in route.ts
  const waybillRows = await p.$queryRawUnsafe(`
    SELECT
      proj.project_uuid::text,
      SUM(COALESCE(w.sum,0))::text AS waybill_sum,
      proj.financial_code_uuid::text AS project_fc_uuid,
      cost_fc.code AS paired_fc_code
    FROM projects proj
    JOIN rs_waybills_in w ON w.project_uuid = proj.project_uuid
    LEFT JOIN financial_codes fc_income ON fc_income.uuid = proj.financial_code_uuid
    LEFT JOIN financial_codes cost_fc ON cost_fc.uuid = fc_income.default_code_fc
    WHERE proj.project_uuid IN ($1::uuid)
    GROUP BY proj.project_uuid, proj.financial_code_uuid, cost_fc.code, cost_fc.validation
    HAVING SUM(COALESCE(w.sum, 0)) > 0
  `, testUuid);
  
  console.log("Waybill query result:");
  waybillRows.forEach(r => {
    console.log("  project_uuid:", JSON.stringify(r.project_uuid));
    console.log("  typeof:", typeof r.project_uuid);
    console.log("  waybill_sum:", r.waybill_sum);
    console.log("  paired_fc_code:", r.paired_fc_code);
  });
  
  // Now check: what does the main query return for project_uuid key?
  const mainRows = await p.$queryRawUnsafe(`
    SELECT p.project_uuid, p.project_uuid::text AS project_uuid_text
    FROM payments p
    WHERE p.project_uuid = $1::uuid
    LIMIT 1
  `, testUuid);
  
  console.log("\nMain query project_uuid type check:");
  if (mainRows.length > 0) {
    const r = mainRows[0];
    console.log("  project_uuid:", JSON.stringify(r.project_uuid));
    console.log("  typeof:", typeof r.project_uuid);
    console.log("  project_uuid_text:", JSON.stringify(r.project_uuid_text));
    console.log("  keys match?", r.project_uuid === r.project_uuid_text);
  }
  
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
