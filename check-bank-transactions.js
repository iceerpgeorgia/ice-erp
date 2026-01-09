const { PrismaClient } = require('@prisma/client');

async function checkData() {
  const prisma = new PrismaClient();
  
  try {
    const count = await prisma.consolidatedBankAccount.count();
    console.log('Total consolidated_bank_account records:', count);
    
    if (count > 0) {
      const sample = await prisma.consolidatedBankAccount.findFirst({
        include: {
          bankAccount: {
            include: {
              bank: true
            }
          }
        }
      });
      console.log('\nSample record:', JSON.stringify(sample, null, 2));
    }
    
    // Check if bankAccount relation exists
    const withAccount = await prisma.consolidatedBankAccount.count({
      where: {
        bankAccount: {
          isNot: null
        }
      }
    });
    console.log('\nRecords with bank account:', withAccount);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
