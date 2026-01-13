const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDisplayOrder() {
  try {
    // Get records in the same order as the API does (desc by id, take 250)
    const transactions = await prisma.consolidatedBankAccount.findMany({
      orderBy: [{ id: 'desc' }],
      select: {
        id: true,
        uuid: true,
        counteragentAccountNumber: true,
        transactionDate: true,
        description: true
      },
      skip: 200, // Skip first 200 to get around position 203
      take: 10   // Take 10 records around position 203
    });
    
    console.log('=== Records around position 200-210 (0-indexed) ===');
    console.log('Note: Frontend might show these as rows 201-211');
    transactions.forEach((record, idx) => {
      console.log(`\nRow ${200 + idx + 1} (DB ID: ${record.id})`);
      console.log(`  UUID: ${record.uuid}`);
      console.log(`  Date: ${record.transactionDate}`);
      console.log(`  CA Account: ${record.counteragentAccountNumber}`);
      console.log(`  Description: ${record.description?.substring(0, 80)}...`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDisplayOrder();
