const { PrismaClient } = require('@prisma/client');

async function checkSupabase() {
  // Connect to Supabase directly
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
      }
    }
  });
  
  try {
    console.log('Connecting to Supabase...\n');
    
    const count = await prisma.consolidatedBankAccount.count();
    console.log('Total consolidated_bank_account records on Supabase:', count);
    
    if (count > 0) {
      const sample = await prisma.consolidatedBankAccount.findFirst({
        take: 1
      });
      console.log('\nSample record (first 500 chars):');
      console.log(JSON.stringify(sample, null, 2).substring(0, 500));
    } else {
      console.log('\nNo records found in consolidated_bank_account table.');
      
      // Check other bank-related tables
      try {
        const bankAccountCount = await prisma.bankAccount.count();
        console.log('Bank accounts:', bankAccountCount);
      } catch (e) {
        console.log('Bank accounts: Error -', e.message);
      }
      
      try {
        const rawBankCount = await prisma.rawBankStatementEntry.count();
        console.log('Raw bank statement entries:', rawBankCount);
      } catch (e) {
        console.log('Raw bank statement entries: Error -', e.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSupabase();
