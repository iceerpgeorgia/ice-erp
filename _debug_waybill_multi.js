const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  // Test with several 1.1.1 projects (Shartava, Alliance Privilege, Bagrationi, Holiday Inn)
  const uuids = [
    "9f39081e-da54-4b36-8e76-a61025d8a505",  // Shartava (shows column)
    "70a35471-a9c1-45d1-bfaf-a8c98abeaed7",  // Alliance Privilege (should show but doesn't)
    "9518b3a0-051a-4732-b24d-e59f121af873",  // Bagrationi
    "2702712b-a1e7-43fa-8c75-f84d4bd6d43f",  // Holiday Inn
  ];
  const placeholders = uuids.map((_, i) => `$${i+1}::uuid`).join(', ');
  const rows = await p.$queryRawUnsafe(`
    SELECT
      proj.project_uuid::text,
      proj.project_name,
      SUM(COALESCE(w.sum,0))::text AS waybill_sum,
      proj.financial_code_uuid::text AS project_fc_uuid,
      fc_income.code AS proj_fc_code,
      cost_fc.code AS paired_fc_code
    FROM projects proj
    JOIN rs_waybills_in w ON w.project_uuid = proj.project_uuid
    LEFT JOIN financial_codes fc_income ON fc_income.uuid = proj.financial_code_uuid
    LEFT JOIN financial_codes cost_fc ON cost_fc.uuid = fc_income.default_code_fc
    WHERE proj.project_uuid IN (${placeholders})
    GROUP BY proj.project_uuid, proj.project_name, proj.financial_code_uuid, fc_income.code, cost_fc.code, cost_fc.validation
    HAVING SUM(COALESCE(w.sum, 0)) > 0
  `, ...uuids);
  console.log("Waybill query results for multi-project:");
  rows.forEach(r => console.log(" ", r.project_name, "| proj_fc:", r.proj_fc_code, "| paired:", r.paired_fc_code, "| sum:", r.waybill_sum));
  console.log("Count:", rows.length);
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
