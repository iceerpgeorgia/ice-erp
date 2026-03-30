const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const dups = await p.salary_accruals.findMany({ where: { id: { in: [6150, 6151] } }, orderBy: { id: 'asc' } });
  dups.forEach(d => console.log('ID:', Number(d.id), 'net_sum:', d.net_sum?.toString(), 'deducted_insurance:', d.deducted_insurance?.toString(), 'confirmed:', d.confirmed, 'payment_id:', d.payment_id));

  const late = await p.$queryRawUnsafe(
    `SELECT id, counteragent_uuid, financial_code_uuid, net_sum, deducted_insurance, created_at
     FROM salary_accruals
     WHERE salary_month >= '2026-03-01' AND salary_month < '2026-04-01'
       AND created_at > '2026-03-30T14:30:00Z'
     ORDER BY created_at`
  );
  console.log('\nLate records:');
  late.forEach(r => console.log('ID:', Number(r.id), 'ca:', r.counteragent_uuid, 'net:', r.net_sum?.toString(), 'ins:', r.deducted_insurance?.toString(), 'at:', r.created_at));
  await p.$disconnect();
})();
