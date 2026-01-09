const { PrismaClient } = require('@prisma/client');

async function debugSupabase() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
      }
    }
  });
  
  try {
    console.log('Testing Supabase consolidated_bank_accounts table...\n');
    
    // Check basic count
    const count = await prisma.consolidatedBankAccount.count();
    console.log('✓ Total records:', count);
    
    // Check if we can fetch without includes
    const simple = await prisma.consolidatedBankAccount.findMany({ take: 2 });
    console.log('✓ Can fetch basic records:', simple.length);
    
    // Try with the bankAccount relation
    try {
      const withRelation = await prisma.consolidatedBankAccount.findMany({
        take: 2,
        include: {
          bankAccount: true
        }
      });
      console.log('✓ Can fetch with bankAccount relation:', withRelation.length);
      
      // Check if any have null bankAccount
      const nullAccounts = withRelation.filter(r => !r.bankAccount);
      if (nullAccounts.length > 0) {
        console.log('⚠ Records with NULL bankAccount:', nullAccounts.length);
      }
    } catch (e) {
      console.error('✗ ERROR fetching with bankAccount relation:');
      console.error('  Message:', e.message);
      console.error('  Code:', e.code);
    }
    
    // Try the full query from the API
    try {
      console.log('\nTesting full API query...');
      const fullQuery = await prisma.consolidatedBankAccount.findMany({
        include: {
          bankAccount: {
            include: {
              bank: true
            }
          }
        },
        orderBy: [
          { date: 'desc' },
          { id: 'desc' }
        ],
        take: 5
      });
      console.log('✓ Full query successful, fetched:', fullQuery.length, 'records');
      
      // Check accountUuid integrity
      const accountUuids = [...new Set(simple.map(r => r.accountUuid))];
      console.log('\nUnique account UUIDs in sample:', accountUuids.length);
      
      for (const uuid of accountUuids.slice(0, 3)) {
        const account = await prisma.bankAccount.findUnique({
          where: { uuid }
        });
        if (!account) {
          console.log('⚠ Missing bankAccount for UUID:', uuid);
        } else {
          console.log('✓ Found bankAccount:', uuid);
        }
      }
      
    } catch (e) {
      console.error('✗ ERROR with full query:');
      console.error('  Message:', e.message);
    }
    
  } catch (error) {
    console.error('\n✗ FATAL ERROR:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSupabase();
