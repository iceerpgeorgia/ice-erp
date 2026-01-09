const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

async function applyLocalMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Applying parsing_scheme_id column to local database...\n');
    
    // Check if column exists
    const checkColumn = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bank_accounts' 
      AND column_name = 'parsing_scheme_id'
    `;
    
    if (checkColumn.length > 0) {
      console.log('✅ Column already exists!');
      return;
    }
    
    console.log('Adding column...');
    await prisma.$executeRaw`
      ALTER TABLE "bank_accounts" ADD COLUMN "parsing_scheme_id" BIGINT;
    `;
    console.log('✓ Column added\n');
    
    console.log('Adding index...');
    await prisma.$executeRaw`
      CREATE INDEX "bank_accounts_parsing_scheme_id_idx" ON "bank_accounts"("parsing_scheme_id");
    `;
    console.log('✓ Index created\n');
    
    console.log('Adding foreign key...');
    await prisma.$executeRaw`
      ALTER TABLE "bank_accounts" 
      ADD CONSTRAINT "bank_accounts_parsing_scheme_id_fkey" 
      FOREIGN KEY ("parsing_scheme_id") REFERENCES "parsing_schemes"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `;
    console.log('✓ Foreign key added\n');
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

applyLocalMigration();
