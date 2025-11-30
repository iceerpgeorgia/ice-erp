const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testTriggerWithData() {
  try {
    console.log('🧪 Testing triggers with actual insert...\n');
    
    // Get sample data to use
    console.log('📋 Fetching reference data:');
    
    const counteragent = await prisma.$queryRaw`
      SELECT counteragent_uuid, name, internal_number 
      FROM counteragents 
      WHERE is_active = true AND internal_number IS NOT NULL
      LIMIT 1
    `;
    
    const financialCode = await prisma.$queryRaw`
      SELECT uuid, code, validation 
      FROM financial_codes 
      WHERE is_active = true 
      LIMIT 1
    `;
    
    const currency = await prisma.$queryRaw`
      SELECT uuid, code 
      FROM currencies 
      WHERE is_active = true 
      LIMIT 1
    `;
    
    const state = await prisma.$queryRaw`
      SELECT uuid, name 
      FROM project_states 
      WHERE is_active = true 
      LIMIT 1
    `;
    
    if (counteragent.length === 0 || financialCode.length === 0 || currency.length === 0 || state.length === 0) {
      console.log('❌ Missing required reference data');
      return;
    }
    
    console.log(`  Counteragent: ${counteragent[0].name} (internal: ${counteragent[0].internal_number})`);
    console.log(`  Financial Code: ${financialCode[0].code} - ${financialCode[0].validation}`);
    console.log(`  Currency: ${currency[0].code}`);
    console.log(`  State: ${state[0].name}`);
    console.log('');
    
    // Insert a test project
    console.log('📝 Inserting test project...');
    
    const insertResult = await prisma.$executeRawUnsafe(`
      INSERT INTO projects (
        project_name,
        counteragent_uuid,
        financial_code_uuid,
        date,
        currency_uuid,
        value,
        state_uuid,
        oris_1630
      ) VALUES (
        $1, $2::uuid, $3::uuid, $4::date, $5::uuid, $6, $7::uuid, $8
      )
      RETURNING project_uuid
    `, 
      'TestProject2024',
      counteragent[0].counteragent_uuid,
      financialCode[0].uuid,
      new Date('2024-12-25'),
      currency[0].uuid,
      12500.50,
      state[0].uuid,
      'TEST123'
    );
    
    // Now query the inserted project
    const testProject = await prisma.$queryRaw`
      SELECT 
        project_uuid,
        project_name,
        counteragent,
        financial_code,
        currency,
        state,
        contract_no,
        project_index
      FROM projects
      WHERE project_name = 'TestProject2024'
      LIMIT 1
    `;
    
    console.log('✅ Project inserted! Checking computed fields:\n');
    
    const p = testProject[0];
    console.log(`  UUID: ${p.project_uuid}`);
    console.log(`  Name: ${p.project_name}`);
    console.log(`  Counteragent: ${p.counteragent || '❌ NULL'}`);
    console.log(`  Financial Code: ${p.financial_code || '❌ NULL'}`);
    console.log(`  Currency: ${p.currency || '❌ NULL'}`);
    console.log(`  State: ${p.state || '❌ NULL'}`);
    console.log(`  Contract No: ${p.contract_no || '❌ NULL'}`);
    console.log(`  Project Index: ${p.project_index || '❌ NULL'}`);
    console.log('');
    
    // Verify all fields are populated
    const allPopulated = p.counteragent && p.financial_code && p.currency && p.state && p.contract_no && p.project_index;
    
    if (allPopulated) {
      console.log('✅ SUCCESS! All computed fields were populated by triggers!');
    } else {
      console.log('⚠️  WARNING: Some computed fields are NULL. Triggers may not be working correctly.');
    }
    
    // Clean up - delete test project
    console.log('');
    console.log('🧹 Cleaning up test data...');
    await prisma.$executeRawUnsafe(`
      DELETE FROM projects WHERE project_uuid = $1::uuid
    `, p.project_uuid);
    console.log('✓ Test project deleted');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('');
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTriggerWithData();
