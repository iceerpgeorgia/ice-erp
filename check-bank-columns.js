const { PrismaClient } = require('@prisma/client');

async function checkColumns() {
  console.log('=== LOCAL DATABASE ===');
  const localPrisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ICE_ERP' } }
  });
  
  try {
    const localCols = await localPrisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bank_accounts' 
      ORDER BY ordinal_position
    `;
    console.log('bank_accounts columns:');
    localCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
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
    const supabaseCols = await supabasePrisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bank_accounts' 
      ORDER BY ordinal_position
    `;
    console.log('bank_accounts columns:');
    supabaseCols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await supabasePrisma.$disconnect();
  }
}

checkColumns();
