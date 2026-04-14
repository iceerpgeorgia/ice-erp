const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Applying migration: add dates and payment_id to project_bundle_payments...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "project_bundle_payments"
      ADD COLUMN IF NOT EXISTS "payment_id" TEXT,
      ADD COLUMN IF NOT EXISTS "accrual_date" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "order_date" TIMESTAMP(3)
    `);
    
    console.log('Creating index on payment_id...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "project_bundle_payments_payment_id_idx" 
      ON "project_bundle_payments"("payment_id")
    `);
    
    console.log('✓ Migration applied successfully');
  } catch (error) {
    console.error('Error applying migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
