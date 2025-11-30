const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkColumns() {
  const columns = await prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'projects'
    AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  
  console.log('Projects table columns:');
  columns.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
  
  await prisma.$disconnect();
}

checkColumns();
