const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugFunctionCreation() {
  try {
    console.log('🔍 Testing function creation directly...\n');
    
    // Try to create a simple test function
    console.log('Creating test function populate_project_counteragent...');
    
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION populate_project_counteragent()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Lookup counteragent name by UUID
        SELECT name INTO NEW.counteragent
        FROM counteragents
        WHERE counteragent_uuid = NEW.counteragent_uuid;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✓ Function created successfully!');
    
    // Verify it exists
    const check = await prisma.$queryRaw`
      SELECT proname 
      FROM pg_proc 
      WHERE proname = 'populate_project_counteragent'
    `;
    
    console.log(`✓ Function verified: ${check.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);
    
    if (check.length > 0) {
      console.log('');
      console.log('Now creating trigger...');
      
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS trigger_populate_project_counteragent ON projects;
        CREATE TRIGGER trigger_populate_project_counteragent
          BEFORE INSERT OR UPDATE ON projects
          FOR EACH ROW
          EXECUTE FUNCTION populate_project_counteragent();
      `);
      
      console.log('✓ Trigger created successfully!');
      
      // Verify trigger
      const triggerCheck = await prisma.$queryRaw`
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgname = 'trigger_populate_project_counteragent'
      `;
      
      console.log(`✓ Trigger verified: ${triggerCheck.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

debugFunctionCreation();
