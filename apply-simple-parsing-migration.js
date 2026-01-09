const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Dropping old parsing tables...');
    
    // Drop old tables
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "bank_accounts_parsing_rules" CASCADE`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "parsing_schemes" CASCADE`);
    console.log('✓ Old tables dropped');
    
    // Remove parsing_scheme_id column from bank_accounts if exists
    await prisma.$executeRawUnsafe(`ALTER TABLE "bank_accounts" DROP COLUMN IF EXISTS "parsing_scheme_id"`);
    console.log('✓ Removed parsing_scheme_id from bank_accounts');
    
    console.log('Creating new parsing_schemes table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "parsing_schemes" (
        "scheme" VARCHAR(50) NOT NULL PRIMARY KEY,
        "uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()
      )
    `);
    console.log('✓ parsing_schemes table created');
    
    console.log('Creating parsing_scheme_rules table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "parsing_scheme_rules" (
        "id" BIGSERIAL PRIMARY KEY,
        "scheme_uuid" UUID NOT NULL REFERENCES "parsing_schemes"("uuid") ON DELETE CASCADE,
        "column_name" VARCHAR(100) NOT NULL,
        "condition" TEXT NOT NULL,
        "payment_id" VARCHAR(255) NOT NULL
      )
    `);
    console.log('✓ parsing_scheme_rules table created');
    
    console.log('Creating indexes...');
    await prisma.$executeRawUnsafe(`CREATE INDEX "parsing_scheme_rules_scheme_uuid_idx" ON "parsing_scheme_rules"("scheme_uuid")`);
    console.log('✓ Indexes created');
    
    console.log('Inserting default schemes...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "parsing_schemes" ("scheme") VALUES 
        ('BOG_GEL'),
        ('BOG_FX'),
        ('TBC_GEL'),
        ('TBC_FX')
    `);
    console.log('✓ 4 default schemes inserted: BOG_GEL, BOG_FX, TBC_GEL, TBC_FX');
    
    console.log('\n✅ Migration completed successfully!');
    
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
