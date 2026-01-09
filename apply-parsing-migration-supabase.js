const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.vercel' });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  try {
    console.log('Connecting to Supabase...');
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
      CREATE TABLE IF NOT EXISTS "parsing_schemes" (
        "scheme" VARCHAR(50) NOT NULL PRIMARY KEY,
        "uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()
      )
    `);
    console.log('✓ parsing_schemes table created');
    
    console.log('Creating parsing_scheme_rules table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "parsing_scheme_rules" (
        "id" BIGSERIAL PRIMARY KEY,
        "scheme_uuid" UUID NOT NULL REFERENCES "parsing_schemes"("uuid") ON DELETE CASCADE,
        "column_name" VARCHAR(100) NOT NULL,
        "condition" TEXT NOT NULL,
        "payment_id" VARCHAR(255) NOT NULL
      )
    `);
    console.log('✓ parsing_scheme_rules table created');
    
    console.log('Creating indexes...');
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "parsing_scheme_rules_scheme_uuid_idx" ON "parsing_scheme_rules"("scheme_uuid")`);
    console.log('✓ Indexes created');
    
    console.log('Inserting default schemes...');
    // Check if schemes already exist
    const existingSchemes = await prisma.$queryRaw`SELECT scheme FROM "parsing_schemes"`;
    if (existingSchemes.length === 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "parsing_schemes" ("scheme") VALUES 
          ('BOG_GEL'),
          ('BOG_FX'),
          ('TBC_GEL'),
          ('TBC_FX')
      `);
      console.log('✓ 4 default schemes inserted: BOG_GEL, BOG_FX, TBC_GEL, TBC_FX');
    } else {
      console.log(`✓ Schemes already exist (${existingSchemes.length} found)`);
    }
    
    console.log('\n✅ Supabase migration completed successfully!');
    
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
