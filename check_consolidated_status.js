require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkStatus() {
  try {
    console.log('\n========================================');
    console.log('  CONSOLIDATED TABLE STATUS');
    console.log('========================================\n');

    const count = await prisma.consolidated_bank_accounts.count();
    console.log(`Current consolidated records: ${count}\n`);

    const accounts = await prisma.bank_accounts.findMany({
      select: {
        uuid: true,
        account_number: true,
        bank_name: true,
        currency_uuid: true
      }
    });

    console.log(`Bank accounts (${accounts.length}):`);
    accounts.forEach(a => {
      console.log(`  - ${a.account_number} (${a.bank_name})`);
    });

    console.log('\n========================================\n');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
