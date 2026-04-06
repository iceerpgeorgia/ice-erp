const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const row = await p.counteragents.findFirst({ where: { is_emploee: true } });
  console.log('has department key:', row !== null && 'department' in row);
  console.log('department value:', row ? row.department : 'N/A');
  await p.$disconnect();
})();
