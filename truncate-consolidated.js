const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function truncate() {
  try {
    await prisma.$executeRaw`TRUNCATE TABLE consolidated_bank_accounts CASCADE`;
    console.log('✅ Truncated consolidated_bank_accounts');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

truncate();
