const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testImport() {
  try {
    console.log('Testing Prisma project model...');
    
    // Test findMany
    const count = await prisma.$queryRaw`SELECT COUNT(*) FROM projects`;
    console.log('Current projects in DB:', count[0].count);
    
    // Test create
    const testProject = await prisma.project.create({
      data: {
        projectUuid: 'test-uuid-12345-67890',
        counteragentUuid: '6DECD64D-60DA-49AE-A9B3-49D7E02F2D62',
        projectName: 'Test Project Import',
        financialCodeUuid: 'B59170EC-16CC-499A-9FF7-0428DCB8F727',
        date: new Date('2025-01-01'),
        value: 1000.50,
        currencyUuid: '0790fb09-2de6-4ea3-a71c-58a007fc62a8',
        stateUuid: '9fed28b3-82cf-4afa-8e8d-952adf7a54a5'
      }
    });
    
    console.log('✓ Created test project:', testProject.projectName);
    
    // Delete test project
    await prisma.project.delete({
      where: { projectUuid: 'test-uuid-12345-67890' }
    });
    
    console.log('✓ Deleted test project');
    console.log('\n✅ Prisma client is working correctly!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testImport();
