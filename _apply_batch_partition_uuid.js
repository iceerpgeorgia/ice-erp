const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Applying raw_record_uuid and batch_partition_uuid migrations...');

  try {
    // First migration: raw_record_uuid
    console.log('\n1️⃣  Applying raw_record_uuid migration...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "payments_jobs" ADD COLUMN IF NOT EXISTS "raw_record_uuid" UUID;
    `);
    console.log('✓ Added raw_record_uuid column');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_payments_jobs_raw_record_uuid" 
      ON "payments_jobs"("raw_record_uuid");
    `);
    console.log('✓ Created index on raw_record_uuid');

    // Second migration: batch_partition_uuid
    console.log('\n2️⃣  Applying batch_partition_uuid migration...');
    
    // Add column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "payments_jobs" ADD COLUMN IF NOT EXISTS "batch_partition_uuid" UUID;
    `);
    console.log('✓ Added batch_partition_uuid column');

    // Create index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_payments_jobs_batch_partition_uuid" 
      ON "payments_jobs"("batch_partition_uuid");
    `);
    console.log('✓ Created index on batch_partition_uuid');

    // Add foreign key constraint
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'payments_jobs_batch_partition_uuid_fkey'
        ) THEN
          ALTER TABLE "payments_jobs" 
            ADD CONSTRAINT "payments_jobs_batch_partition_uuid_fkey" 
            FOREIGN KEY ("batch_partition_uuid") 
            REFERENCES "bank_transaction_batches"("uuid") 
            ON DELETE NO ACTION 
            ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    console.log('✓ Added foreign key constraint');

    // Add comments
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN "payments_jobs"."batch_partition_uuid" IS 
      'Optional link to specific batch partition (bank_transaction_batches.uuid) when raw transaction is split into batches. Allows autonomous distribution per partition.';
    `);
    
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN "payments_jobs"."raw_record_uuid" IS 
      'Optional link to specific bank transaction record (consolidated_bank_accounts.record_uuid). Used for non-batched transactions.';
    `);
    console.log('✓ Added column comments');

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
