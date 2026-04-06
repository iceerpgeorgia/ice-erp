const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Adding document_value and document_currency_uuid columns to attachments table...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE attachments 
      ADD COLUMN IF NOT EXISTS document_value DECIMAL(15,2);
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE attachments 
      ADD COLUMN IF NOT EXISTS document_currency_uuid UUID;
    `);
    
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
