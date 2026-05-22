const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  // All projects with FC 1.1.1 and waybill records
  const rows = await p.$queryRawUnsafe(`
    SELECT 
      proj.project_uuid::text AS proj_uuid,
      proj.project_name,
      COUNT(w.id)::text AS waybill_count,
      SUM(COALESCE(w.sum,0))::text AS waybill_total
    FROM projects proj
    LEFT JOIN financial_codes fc ON fc.uuid = proj.financial_code_uuid
    LEFT JOIN rs_waybills_in w ON w.project_uuid = proj.project_uuid
    WHERE fc.code = '1.1.1'
    GROUP BY proj.project_uuid, proj.project_name
    ORDER BY waybill_count DESC
  `);
  console.log("All 1.1.1 projects with waybill counts:");
  rows.forEach(r => console.log(" ", r.project_name, "| waybills:", r.waybill_count, "| total:", r.waybill_total, "| uuid:", r.proj_uuid));
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
