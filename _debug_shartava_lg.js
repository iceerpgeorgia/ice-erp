const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  // Check Shartava LG's FCs and also verify waybill UUID linkage
  const uuid = "1f12a81b-7b38-4373-9cd3-33d000f982e9";  // Shartava LG
  
  const fcs = await p.$queryRawUnsafe(`
    SELECT fc.code, fc.is_income, COUNT(*)::text AS cnt
    FROM payments pay JOIN financial_codes fc ON fc.uuid = pay.financial_code_uuid
    WHERE pay.project_uuid = $1::uuid GROUP BY fc.code, fc.is_income ORDER BY fc.code
  `, uuid);
  console.log("Shartava LG payment FCs:");
  fcs.forEach(r => console.log(" ", r.code, r.is_income ? "(income)" : "(cost)", "cnt:", r.cnt));
  
  // Check if waybill records for Shartava LG actually have project_uuid set
  const waybills = await p.$queryRawUnsafe(`
    SELECT w.project_uuid::text, SUM(COALESCE(w.sum,0))::text AS total, COUNT(*)::text AS cnt
    FROM rs_waybills_in w WHERE w.project_uuid = $1::uuid GROUP BY w.project_uuid
  `, uuid);
  console.log("\nWaybills linked to Shartava LG:", waybills.length > 0 ? waybills[0] : "NONE");
  
  // Run actual waybill query against Shartava LG
  const wb = await p.$queryRawUnsafe(`
    SELECT proj.project_uuid::text, proj.project_name,
      SUM(COALESCE(w.sum, 0))::text AS waybill_sum,
      proj.financial_code_uuid::text AS project_fc_uuid,
      cost_fc.code AS paired_fc_code
    FROM projects proj
    JOIN rs_waybills_in w ON w.project_uuid = proj.project_uuid
    LEFT JOIN financial_codes fc_income ON fc_income.uuid = proj.financial_code_uuid
    LEFT JOIN financial_codes cost_fc ON cost_fc.uuid = fc_income.default_code_fc
    WHERE proj.project_uuid = $1::uuid
    GROUP BY proj.project_uuid, proj.project_name, proj.financial_code_uuid, cost_fc.code, cost_fc.validation
    HAVING SUM(COALESCE(w.sum, 0)) > 0
  `, uuid);
  console.log("\nWaybill query result for Shartava LG:", wb.length > 0 ? wb[0] : "NO ROWS RETURNED");
  
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
