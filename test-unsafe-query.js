const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('Testing $queryRawUnsafe with string array...');
  
  const idsParam = '7096,7095,7094';
  const idsArray = idsParam.split(',').map(id => id.trim());
  
  console.log('IDs array:', idsArray);
  
  const result = await prisma.$queryRawUnsafe(
    `SELECT cba.id, cba.transaction_date, cba.correction_date, cba.exchange_rate
     FROM consolidated_bank_accounts cba
     WHERE cba.id = ANY($1::bigint[])
     ORDER BY cba.transaction_date DESC, cba.id DESC`,
    idsArray
  );
  
  console.log('\nResult:', result);
  console.log('\nFound', result.length, 'records');
  
  if (result.length > 0) {
    result.forEach(r => {
      console.log(`\nID: ${r.id}`);
      console.log(`  transaction_date: ${r.transaction_date}`);
      console.log(`  correction_date: ${r.correction_date}`);
      console.log(`  exchange_rate: ${r.exchange_rate}`);
    });
  }
  
})().catch(err => {
  console.error('Error:', err.message);
  console.error('Full error:', err);
}).finally(() => prisma.$disconnect());
