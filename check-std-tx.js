const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Find the transaction in standardized_transactions
    const tx = await prisma.standardized_transactions.findUnique({
      where: { uuid: '3ca0c418-67a3-58cb-a249-fab2df655909' }
    });
    
    if (tx) {
      console.log('✓ Transaction found in standardized_transactions:');
      console.log(JSON.stringify(tx, null, 2));
    } else {
      console.log('✗ Transaction NOT found in standardized_transactions');
      
      // Try searching for it in other ways
      console.log('\nSearching for transaction by uuid pattern...');
      const similar = await prisma.standardized_transactions.findMany({
        where: {
          uuid: { contains: '3ca0c418' }
        },
        take: 5
      });
      console.log(`Found ${similar.length} transactions with similar uuid`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await prisma.$disconnect();
})();
