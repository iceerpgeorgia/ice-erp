const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTable() {
  // Get the actual table structure from pg_catalog
  const columns = await prisma.$queryRaw`
    SELECT 
      a.attname as column_name,
      a.attnum as position,
      t.typname as type
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_type t ON a.atttypid = t.oid
    WHERE c.relname = 'projects'
    AND n.nspname = 'public'
    AND a.attnum > 0
    AND NOT a.attisdropped
    ORDER BY a.attnum
  `;
  
  console.log('Actual projects table structure from pg_catalog:');
  columns.forEach(c => {
    console.log(`  ${c.position}. ${c.column_name} (${c.type})`);
  });
  
  // Check if there are any pending schema changes
  console.log('\nChecking for schema locks or pending changes...');
  const locks = await prisma.$queryRaw`
    SELECT 
      locktype,
      relation::regclass,
      mode,
      granted
    FROM pg_locks
    WHERE relation = 'projects'::regclass
  `;
  console.log('Active locks:', locks);
  
  await prisma.$disconnect();
}

checkTable();
