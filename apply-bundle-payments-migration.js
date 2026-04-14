const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Applying project_bundle_payments migration...');
    
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "project_bundle_payments" (
          "id" BIGSERIAL NOT NULL,
          "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
          "project_uuid" UUID NOT NULL,
          "financial_code_uuid" UUID NOT NULL,
          "percentage" DECIMAL(5,2),
          "amount" DECIMAL(18,2),
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "project_bundle_payments_pkey" PRIMARY KEY ("id")
      );
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "project_bundle_payments_uuid_key" 
      ON "project_bundle_payments"("uuid");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_project_bundle_payments_project_fc" 
      ON "project_bundle_payments"("project_uuid", "financial_code_uuid");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "project_bundle_payments_project_uuid_idx" 
      ON "project_bundle_payments"("project_uuid");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "project_bundle_payments_financial_code_uuid_idx" 
      ON "project_bundle_payments"("financial_code_uuid");
    `);
    
    console.log('â?? Migration applied successfully');
  } catch (error) {
    console.error('??? Migration error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();