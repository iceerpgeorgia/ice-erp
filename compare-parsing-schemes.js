const { PrismaClient } = require('@prisma/client');

async function checkBoth() {
  console.log('=== LOCAL DATABASE ===');
  const localPrisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ICE_ERP' } }
  });
  
  try {
    const localSchemes = await localPrisma.$queryRaw`SELECT * FROM parsing_schemes ORDER BY scheme`;
    console.log(localSchemes);
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await localPrisma.$disconnect();
  }
  
  console.log('\n=== SUPABASE ===');
  const supabasePrisma = new PrismaClient({
    datasources: { 
      db: { 
        url: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
      } 
    }
  });
  
  try {
    const supabaseSchemes = await supabasePrisma.$queryRaw`SELECT * FROM parsing_schemes ORDER BY scheme`;
    console.log(supabaseSchemes);
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await supabasePrisma.$disconnect();
  }
}

checkBoth();
