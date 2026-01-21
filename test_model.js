const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing ConsolidatedBankAccount model...');
    const count = await prisma.consolidatedBankAccount.count();
    console.log('✓ Count successful:', count);
    
    const sample = await prisma.consolidatedBankAccount.findFirst({
      include: { bankAccount: true }
    });
    console.log('✓ FindFirst with include successful');
    console.log('Sample bankAccount:', sample?.bankAccount ? 'exists' : 'null');
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

test();
