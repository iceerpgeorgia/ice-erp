const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.salary_accruals.delete({ where: { id: 6151 } });
  console.log('Deleted duplicate record ID 6151');
  await p.$disconnect();
})();
