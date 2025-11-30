const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function introspect() {
  console.log('Running Prisma introspection...\n');
  
  // Check what Prisma sees
  const prismaView = await prisma.$queryRaw`
    SELECT 
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'projects'
    ORDER BY ordinal_position
  `;
  
  console.log('Columns that Prisma sees in projects table:');
  prismaView.forEach((col, idx) => {
    console.log(`  ${idx + 1}. ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  });
  
  // Check which database URL Prisma is using
  console.log('\nChecking DATABASE_URL...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
  
  await prisma.$disconnect();
}

introspect();
