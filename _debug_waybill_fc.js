const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  // Find Shartava project
  const proj = await p.$queryRawUnsafe(`
    SELECT proj.project_uuid::text, proj.project_name, proj.financial_code_uuid::text AS proj_fc_uuid,
      fc.code AS proj_fc_code, fc.default_code_fc::text AS default_code_fc, cost_fc.code AS cost_fc_code
    FROM projects proj
    LEFT JOIN financial_codes fc ON fc.uuid = proj.financial_code_uuid
    LEFT JOIN financial_codes cost_fc ON cost_fc.uuid = fc.default_code_fc
    WHERE proj.project_name ILIKE '%შარტ%' OR proj.project_name ILIKE '%shart%'
  `);
  console.log('Shartava projects:');
  proj.forEach(r => console.log(' ', r.project_name, '| proj_fc:', r.proj_fc_code, '| default_code_fc:', r.default_code_fc, '| cost_fc:', r.cost_fc_code));
  
  // Check all FCs that have default_code_fc set
  const fcs = await p.$queryRawUnsafe(`
    SELECT fc.uuid::text, fc.code, fc.validation, fc.default_code_fc::text, cost_fc.code AS cost_code
    FROM financial_codes fc
    JOIN financial_codes cost_fc ON cost_fc.uuid = fc.default_code_fc
  `);
  console.log('\nAll FCs with default_code_fc set:');
  fcs.forEach(r => console.log(' ', r.code, '->', r.cost_code, '(uuid:', r.uuid, ')'));
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
