const { PrismaClient } = require('@prisma/client');

// Use Supabase connection string directly
const SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: SUPABASE_URL
    }
  }
});

async function deleteFromSupabase() {
  try {
    console.log('Connecting to Supabase...');
    
    // First, show what will be deleted
    const toDelete = await prisma.nBGExchangeRate.findMany({
      where: {
        date: {
          gte: new Date('2025-11-20')
        }
      },
      orderBy: { date: 'asc' }
    });
    
    console.log(`Found ${toDelete.length} records to delete from Supabase:`);
    toDelete.forEach(r => console.log(`  - ${r.date.toISOString().split('T')[0]}`));
    
    // Delete them
    const result = await prisma.nBGExchangeRate.deleteMany({
      where: {
        date: {
          gte: new Date('2025-11-20')
        }
      }
    });
    
    console.log(`\nDeleted ${result.count} records from Supabase`);
    
    // Verify
    const remaining = await prisma.nBGExchangeRate.findMany({
      orderBy: { date: 'desc' },
      take: 5
    });
    
    console.log('\nLast 5 records in Supabase now:');
    remaining.forEach(r => console.log(`  ${r.date.toISOString().split('T')[0]}`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteFromSupabase();
