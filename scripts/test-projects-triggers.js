const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testTriggers() {
  try {
    console.log('🧪 Testing Projects table triggers...\n');
    
    // First, check what data we have to work with
    console.log('📋 Checking available reference data:');
    
    const counteragents = await prisma.$queryRaw`
      SELECT counteragent_uuid, name, internal_number 
      FROM counteragents 
      WHERE is_active = true 
      LIMIT 5
    `;
    console.log(`  Found ${counteragents.length} counteragents`);
    if (counteragents.length > 0) {
      console.log(`    Example: ${counteragents[0].name} (${counteragents[0].counteragent_uuid})`);
    }
    
    const financialCodes = await prisma.$queryRaw`
      SELECT uuid, code, validation 
      FROM financial_codes 
      WHERE is_active = true 
      LIMIT 5
    `;
    console.log(`  Found ${financialCodes.length} financial codes`);
    if (financialCodes.length > 0) {
      console.log(`    Example: ${financialCodes[0].code} - ${financialCodes[0].validation}`);
    }
    
    const currencies = await prisma.$queryRaw`
      SELECT uuid, code, name 
      FROM currencies 
      WHERE is_active = true 
      LIMIT 5
    `;
    console.log(`  Found ${currencies.length} currencies`);
    if (currencies.length > 0) {
      console.log(`    Example: ${currencies[0].code} - ${currencies[0].name}`);
    }
    
    const states = await prisma.$queryRaw`
      SELECT uuid, name 
      FROM project_states 
      WHERE is_active = true 
      LIMIT 5
    `;
    console.log(`  Found ${states.length} project states`);
    if (states.length > 0) {
      console.log(`    Example: ${states[0].name} (${states[0].uuid})`);
    }
    
    console.log('');
    
    // Check if projects table has any data
    const existingProjects = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM projects
    `;
    console.log(`📊 Existing projects in table: ${existingProjects[0].count}`);
    
    if (existingProjects[0].count > 0) {
      console.log('');
      console.log('🔍 Checking existing project data:');
      
      const sampleProject = await prisma.$queryRaw`
        SELECT 
          project_name,
          date,
          value,
          counteragent,
          financial_code,
          currency,
          state,
          contract_no,
          project_index
        FROM projects
        LIMIT 1
      `;
      
      if (sampleProject.length > 0) {
        const p = sampleProject[0];
        console.log('  Sample project:');
        console.log(`    Name: ${p.project_name}`);
        console.log(`    Date: ${p.date}`);
        console.log(`    Value: ${p.value}`);
        console.log(`    Counteragent: ${p.counteragent || '[NULL - trigger may need to run]'}`);
        console.log(`    Financial Code: ${p.financial_code || '[NULL - trigger may need to run]'}`);
        console.log(`    Currency: ${p.currency || '[NULL - trigger may need to run]'}`);
        console.log(`    State: ${p.state || '[NULL - trigger may need to run]'}`);
        console.log(`    Contract No: ${p.contract_no || '[NULL - trigger may need to run]'}`);
        console.log(`    Project Index: ${p.project_index || '[NULL - trigger may need to run]'}`);
      }
    }
    
    console.log('');
    console.log('✅ Triggers test query complete!');
    
    if (counteragents.length === 0 || financialCodes.length === 0 || currencies.length === 0 || states.length === 0) {
      console.log('');
      console.log('⚠️  WARNING: Missing reference data. Cannot fully test triggers.');
      console.log('   You need to populate: counteragents, financial_codes, currencies, and project_states tables first.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('');
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTriggers();
