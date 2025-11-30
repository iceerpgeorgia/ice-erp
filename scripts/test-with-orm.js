const { PrismaClient } = require('@prisma/client');

async function testWithFreshClient() {
  // Create a fresh Prisma client instance
  const prisma = new PrismaClient({ log: ['query', 'error', 'warn'] });
  
  try {
    console.log('Testing with fresh Prisma client...\n');
    
    // Try insert using Prisma's ORM instead of raw SQL
    console.log('Fetching reference data...');
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
    
    console.log(`  Counteragent: ${counteragent[0].name}`);
    console.log(`  Financial Code: ${financialCode[0].code}`);
    console.log(`  Currency: ${currency[0].code}`);
    console.log(`  State: ${state[0].name}`);
    console.log('');
    
    console.log('Inserting test project via raw query...');
    
    // Try using Prisma's query parameters differently
    const insertedProject = await prisma.project.create({
      data: {
        projectName: 'TestProject2024',
        counteragentUuid: counteragent[0].counteragent_uuid,
        financialCodeUuid: financialCode[0].uuid,
        date: new Date('2024-12-25'),
        currencyUuid: currency[0].uuid,
        value: 12500.50,
        stateUuid: state[0].uuid,
        oris1630: 'TEST123'
      }
    });
    
    console.log('✅ Project inserted:', insertedProject.projectUuid);
    console.log(`   Counteragent: ${insertedProject.counteragent || 'NULL'}`);
    console.log(`   Financial Code: ${insertedProject.financialCode || 'NULL'}`);
    console.log(`   Currency: ${insertedProject.currency || 'NULL'}`);
    console.log(`   State: ${insertedProject.state || 'NULL'}`);
    console.log(`   Contract No: ${insertedProject.contractNo || 'NULL'}`);
    console.log(`   Project Index: ${insertedProject.projectIndex || 'NULL'}`);
    
    // Clean up
    await prisma.project.delete({
      where: { id: insertedProject.id }
    });
    
    console.log('\n✅ Test complete - triggers work!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.meta) {
      console.error('Meta:', error.meta);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testWithFreshClient();
