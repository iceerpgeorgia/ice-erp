const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function testQuery() {
  try {
    console.log('Testing Prisma query with new columns...');
    const result = await prisma.consolidatedBankAccount.findFirst({
      select: {
        transactionDate: true,
        correctionDate: true,
        exchangeRate: true,
      }
    });
    
    console.log('✅ Query successful!');
    console.log('Sample record:', {
      transactionDate: result.transactionDate,
      correctionDate: result.correctionDate,
      exchangeRate: result.exchangeRate ? result.exchangeRate.toString() : null
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

testQuery();
