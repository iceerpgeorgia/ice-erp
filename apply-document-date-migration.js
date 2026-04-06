const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Adding document_date column to attachments table...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE attachments 
      ADD COLUMN IF NOT EXISTS document_date TIMESTAMP(3);
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
