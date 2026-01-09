const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('Adding condition_script column and making column_name nullable...');
    
    await prisma.$executeRaw`
      ALTER TABLE parsing_scheme_rules 
      ADD COLUMN IF NOT EXISTS condition_script TEXT;
    `;
    
    await prisma.$executeRaw`
      ALTER TABLE parsing_scheme_rules 
      ALTER COLUMN column_name DROP NOT NULL;
    `;
    
    console.log('✓ Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
