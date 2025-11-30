// Quick connection test
const { PrismaClient } = require('@prisma/client');

async function testConnections() {
  console.log('Testing database connections...\n');
  
  // Test local
  console.log('1. Testing LOCAL database...');
  const localPrisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public',
      },
    },
  });
  
  try {
    await localPrisma.$connect();
    const count = await localPrisma.country.count();
    console.log(`   ✓ Local connected! Found ${count} countries`);
    await localPrisma.$disconnect();
  } catch (error) {
    console.error('   ✗ Local connection failed:', error.message);
  }
  
  // Test Supabase
  console.log('\n2. Testing SUPABASE database...');
  const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
  console.log('   URL:', supabaseUrl ? supabaseUrl.replace(/:[^:@]+@/, ':****@') : 'NOT SET');
  
  if (!supabaseUrl) {
    console.error('   ✗ SUPABASE_DATABASE_URL not set!');
    return;
  }
  
  const prodPrisma = new PrismaClient({
    datasources: {
      db: {
        url: supabaseUrl,
      },
    },
  });
  
  try {
    await prodPrisma.$connect();
    const count = await prodPrisma.country.count();
    console.log(`   ✓ Supabase connected! Found ${count} countries`);
    await prodPrisma.$disconnect();
  } catch (error) {
    console.error('   ✗ Supabase connection failed:', error.message);
    console.error('   Full error:', error);
  }
}

testConnections()
  .catch(console.error)
  .finally(() => process.exit());
