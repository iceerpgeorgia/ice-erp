const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔄 Testing Supabase database connection...\n');
    
    const result = await prisma.$queryRawUnsafe(`
      SELECT NOW() as current_time
    `);
    
    console.log('✅ DATABASE CONNECTION SUCCESSFUL\n');
    console.log('━'.repeat(70));
    console.log(`Current Time: ${result[0].current_time}`);
    console.log('━'.repeat(70));
    console.log('\n✓ Supabase is online and responding');
    
  } catch (error) {
    console.error('❌ DATABASE CONNECTION FAILED\n');
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
