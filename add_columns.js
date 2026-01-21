const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addColumns() {
  try {
    await prisma.$executeRaw`
      ALTER TABLE consolidated_bank_accounts 
      ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(20, 10),
      ADD COLUMN IF NOT EXISTS correction_date DATE
    `;
    
    console.log('✓ Columns added successfully');
    console.log('  - exchange_rate DECIMAL(20, 10)');
    console.log('  - correction_date DATE');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addColumns();
