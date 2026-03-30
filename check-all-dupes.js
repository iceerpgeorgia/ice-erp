const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const dupes = await p.$queryRawUnsafe(`
    SELECT counteragent_uuid, financial_code_uuid, salary_month, COUNT(*) as cnt
    FROM salary_accruals
    GROUP BY counteragent_uuid, financial_code_uuid, salary_month
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `);
  console.log('Duplicate groups across all months:', dupes.length);
  dupes.forEach(d => console.log(JSON.stringify({
    cnt: Number(d.cnt),
    ca: d.counteragent_uuid,
    fc: d.financial_code_uuid,
    month: d.salary_month,
  })));
  await p.$disconnect();
})();
