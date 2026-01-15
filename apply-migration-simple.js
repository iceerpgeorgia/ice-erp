const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function apply() {
  try {
    console.log('Adding payment_id column...');
    await prisma.$executeRaw`ALTER TABLE consolidated_bank_accounts ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255)`;
    
    console.log('Creating index...');
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_consolidated_payment_id ON consolidated_bank_accounts(payment_id)`;
    
    console.log('✅ Migration applied successfully!');
    
    // Verify
    const check = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'consolidated_bank_accounts' AND column_name = 'payment_id'
    `;
    console.log('Verification:', check);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

apply();
