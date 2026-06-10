const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Find the transaction
    const tx = await prisma.transactions.findUnique({
      where: { id: '3ca0c418-67a3-58cb-a249-fab2df655909' },
      include: { payment: true }
    });
    
    console.log('Transaction found:', JSON.stringify(tx, null, 2));
    
    if (!tx) {
      console.log('\n⚠️  Transaction does not exist in transactions table');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await prisma.$disconnect();
})();
