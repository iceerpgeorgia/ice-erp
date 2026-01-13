const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDateQuery() {
  console.log('=== Sample dates from DB ===');
  const rows = await prisma.consolidatedBankAccount.findMany({ 
    take: 10, 
    orderBy: { transactionDate: 'desc' } 
  });
  
  rows.forEach(r => {
    console.log(`Date: ${r.transactionDate}, Type: ${typeof r.transactionDate}`);
  });

  console.log('\n=== Testing filter with fromDate=2025-01-01 ===');
  const filtered = await prisma.consolidatedBankAccount.findMany({
    where: {
      transactionDate: {
        gte: '2025-01-01'
      }
    },
    take: 5,
    orderBy: { transactionDate: 'desc' }
  });
  
  console.log(`Found ${filtered.length} records >= 2025-01-01:`);
  filtered.forEach(r => console.log(` - ${r.transactionDate}`));

  await prisma.$disconnect();
}

testDateQuery().catch(console.error);
