const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('Testing IDs query with Prisma.join...');
  
  const idsParam = '7096,7095,7094';
  const ids = idsParam.split(',').map(id => BigInt(id.trim()));
  
  console.log('IDs as BigInt array:', ids);
  
  const result = await prisma.$queryRaw`
    SELECT cba.id, cba.transaction_date, cba.correction_date, cba.exchange_rate
    FROM consolidated_bank_accounts cba
    WHERE cba.id = ANY(ARRAY[${Prisma.join(ids)}]::bigint[])
    ORDER BY cba.transaction_date DESC, cba.id DESC
  `;
  
  console.log('\nResult:', result);
  console.log('\nFound', result.length, 'records');
  
  result.forEach(r => {
    console.log(`\nID: ${r.id}`);
    console.log(`  transaction_date: ${r.transaction_date}`);
    console.log(`  correction_date: ${r.correction_date}`);
    console.log(`  exchange_rate: ${r.exchange_rate}`);
  });
  
})().finally(() => prisma.$disconnect());
