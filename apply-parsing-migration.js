const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Applying parsing schemes migration...');
    
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "parsing_schemes" (
          "id" BIGSERIAL NOT NULL,
          "name" VARCHAR(100) NOT NULL,
          "description" TEXT,
          "is_active" BOOLEAN NOT NULL DEFAULT true,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "parsing_schemes_pkey" PRIMARY KEY ("id")
      )`);
    console.log('✓ parsing_schemes table created');
    
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "bank_accounts_parsing_rules" (
          "id" BIGSERIAL NOT NULL,
          "parsing_scheme_id" BIGINT NOT NULL,
          "column_name" VARCHAR(100) NOT NULL,
          "condition_operator" VARCHAR(50) NOT NULL,
          "condition_value" TEXT,
          "payment_id" VARCHAR(255) NOT NULL,
          "priority" INTEGER NOT NULL DEFAULT 0,
          "is_active" BOOLEAN NOT NULL DEFAULT true,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "bank_accounts_parsing_rules_pkey" PRIMARY KEY ("id")
      )`);
    console.log('✓ bank_accounts_parsing_rules table created');
    
    await prisma.$executeRawUnsafe(`DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='bank_accounts' AND column_name='parsing_scheme_id') 
        THEN 
          ALTER TABLE "bank_accounts" ADD COLUMN "parsing_scheme_id" BIGINT;
        END IF;
      END $$`);
    console.log('✓ parsing_scheme_id column added to bank_accounts');
    
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "parsing_schemes_name_key" ON "parsing_schemes"("name")`);
    console.log('✓ Unique index created on parsing_schemes.name');
    
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "bank_accounts_parsing_rules_parsing_scheme_id_idx" ON "bank_accounts_parsing_rules"("parsing_scheme_id")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "bank_accounts_parsing_rules_priority_idx" ON "bank_accounts_parsing_rules"("priority")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "bank_accounts_parsing_rules_is_active_idx" ON "bank_accounts_parsing_rules"("is_active")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "bank_accounts_parsing_scheme_id_idx" ON "bank_accounts"("parsing_scheme_id")`);
    console.log('✓ All indexes created');
    
    await prisma.$executeRawUnsafe(`DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_parsing_rules_parsing_scheme_id_fkey') 
        THEN 
          ALTER TABLE "bank_accounts_parsing_rules" ADD CONSTRAINT "bank_accounts_parsing_rules_parsing_scheme_id_fkey" 
          FOREIGN KEY ("parsing_scheme_id") REFERENCES "parsing_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`);
    
    await prisma.$executeRawUnsafe(`DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_parsing_scheme_id_fkey') 
        THEN 
          ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_parsing_scheme_id_fkey" 
          FOREIGN KEY ("parsing_scheme_id") REFERENCES "parsing_schemes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$`);
    console.log('✓ Foreign key constraints created');
    console.log('✓ Foreign key constraints created');
    
    // Check if BOG_GEL scheme already exists
    const existingScheme = await prisma.$queryRaw`SELECT id FROM "parsing_schemes" WHERE name = 'BOG_GEL'`;
    
    if (existingScheme.length === 0) {
      await prisma.$executeRawUnsafe(`INSERT INTO "parsing_schemes" ("name", "description", "is_active", "updated_at") 
        VALUES ('BOG_GEL', 'Bank of Georgia - GEL accounts standard parsing scheme', true, CURRENT_TIMESTAMP)`);
      console.log('✓ BOG_GEL scheme created');
      
      const updatedCount = await prisma.$executeRawUnsafe(`UPDATE "bank_accounts" ba
        SET "parsing_scheme_id" = (SELECT id FROM "parsing_schemes" WHERE name = 'BOG_GEL')
        WHERE ba."bank_uuid" IN (
            SELECT uuid FROM "banks" WHERE bank_name ILIKE '%Bank of Georgia%' OR bank_name ILIKE '%BOG%'
        )
        AND ba."currency_uuid" IN (
            SELECT uuid FROM "currencies" WHERE code = 'GEL'
        )`);
      
      console.log(`✓ ${updatedCount} BOG GEL bank accounts updated`);
    } else {
      console.log('✓ BOG_GEL scheme already exists');
    }
    
    console.log('✓ Migration applied successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
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
