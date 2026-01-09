const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Adding columns to bank_accounts table...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE bank_accounts 
      ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 2),
      ADD COLUMN IF NOT EXISTS balance_date DATE,
      ADD COLUMN IF NOT EXISTS parsing_scheme_uuid UUID REFERENCES parsing_schemes(uuid)
    `);
    
    console.log('✓ Columns added to local database');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
