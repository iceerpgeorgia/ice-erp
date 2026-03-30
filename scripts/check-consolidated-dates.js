const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const result = await prisma.$queryRawUnsafe(
    `SELECT transaction_date::date as d, COUNT(*) as cnt 
     FROM consolidated_bank_accounts 
     WHERE bank_account_uuid = '60582948-8c5b-4715-b75c-ca03e3d36a4e' 
       AND transaction_date >= '2026-03-24' 
       AND transaction_date <= '2026-03-27' 
     GROUP BY transaction_date::date 
     ORDER BY d`
  );
  console.log('Consolidated (local DB) records by date:');
  result.forEach(r => console.log('  ' + String(r.d).slice(0,10) + ': ' + Number(r.cnt) + ' records'));
  await prisma.$disconnect();
})();
