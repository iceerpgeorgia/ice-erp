const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTable() {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='projects' 
      ORDER BY ordinal_position
    `;
    
    console.log('Projects table columns:');
    columns.forEach(c => console.log('  -', c.column_name));
    
    const count = await prisma.project.count();
    console.log(`\nCurrent project count: ${count}`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTable();
