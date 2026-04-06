const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Adding document_no column to attachments table...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE attachments 
      ADD COLUMN IF NOT EXISTS document_no TEXT;
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
