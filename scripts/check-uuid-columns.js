const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$queryRaw`
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'projects' 
  AND column_name LIKE '%uuid%' 
  ORDER BY column_name
`.then(r => { 
  console.log('UUID columns in projects table:');
  r.forEach(row => console.log(`  ${row.column_name}`));
  prisma.$disconnect(); 
});
