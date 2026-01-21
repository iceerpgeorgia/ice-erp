const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkColumns() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'consolidated_bank_accounts' 
      AND column_name IN ('exchange_rate', 'correction_date')
      ORDER BY column_name
    `;
    
    console.log('Columns in consolidated_bank_accounts:');
    console.log(result);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();
