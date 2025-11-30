const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  // Check which database we're connected to
  const dbInfo = await prisma.$queryRaw`SELECT current_database(), current_schema()`;
  console.log('Connected to:', dbInfo[0]);
  
  // Check if projects table exists
  const tableExists = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE tablename = 'projects' AND schemaname = 'public'
  `;
  console.log('\nprojects table exists:', tableExists.length > 0);
  
  // Get exact column definition
  const columnDef = await prisma.$queryRaw`
    SELECT 
      column_name,
      table_schema,
      table_name,
      ordinal_position,
      data_type
    FROM information_schema.columns
    WHERE table_name = 'projects' 
    AND table_schema = 'public'
    AND column_name = 'financial_code_uuid'
  `;
  console.log('\nfinancial_code_uuid column:', columnDef);
  
  // Try a simple INSERT with just required fields
  console.log('\nAttempting simple insert...');
  try {
    const result = await prisma.$executeRawUnsafe(`
      INSERT INTO projects (project_name, date, value)
      VALUES ('SimpleTest', '2024-12-25', 100.00)
      RETURNING id, project_uuid, project_name
    `);
    console.log('Insert successful:', result);
    
    // Clean up
    await prisma.$executeRawUnsafe(`DELETE FROM projects WHERE project_name = 'SimpleTest'`);
  } catch (error) {
    console.log('Insert failed:', error.message);
  }
  
  await prisma.$disconnect();
}

debug();
