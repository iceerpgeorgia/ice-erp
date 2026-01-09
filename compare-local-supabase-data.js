const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

async function compareData() {
  // Local database
  const localPrisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  // Supabase database
  const supabasePrisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.REMOTE_DATABASE_URL
      }
    }
  });

  try {
    console.log('🔍 Comparing local and Supabase databases...\n');
    
    // Check consolidated_bank_accounts
    const localBankTx = await localPrisma.consolidatedBankAccount.count();
    const supabaseBankTx = await supabasePrisma.consolidatedBankAccount.count();
    
    console.log('📊 consolidated_bank_accounts:');
    console.log(`   Local:    ${localBankTx}`);
    console.log(`   Supabase: ${supabaseBankTx}`);
    console.log(`   ${localBankTx === supabaseBankTx ? '✅ MATCH' : '❌ MISMATCH'}\n`);
    
    // Check bank_accounts
    const localBankAccounts = await localPrisma.bankAccount.count();
    const supabaseBankAccounts = await supabasePrisma.bankAccount.count();
    
    console.log('📊 bank_accounts:');
    console.log(`   Local:    ${localBankAccounts}`);
    console.log(`   Supabase: ${supabaseBankAccounts}`);
    console.log(`   ${localBankAccounts === supabaseBankAccounts ? '✅ MATCH' : '❌ MISMATCH'}\n`);
    
    // Check raw_bank_statement_entries
    try {
      const localRawBank = await localPrisma.rawBankStatementEntry.count();
      const supabaseRawBank = await supabasePrisma.rawBankStatementEntry.count();
      
      console.log('📊 raw_bank_statement_entries:');
      console.log(`   Local:    ${localRawBank}`);
      console.log(`   Supabase: ${supabaseRawBank}`);
      console.log(`   ${localRawBank === supabaseRawBank ? '✅ MATCH' : '❌ MISMATCH'}\n`);
    } catch (e) {
      console.log('📊 raw_bank_statement_entries: Not available\n');
    }
    
    // Check payments
    const localPayments = await localPrisma.payment.count();
    const supabasePayments = await supabasePrisma.payment.count();
    
    console.log('📊 payments:');
    console.log(`   Local:    ${localPayments}`);
    console.log(`   Supabase: ${supabasePayments}`);
    console.log(`   ${localPayments === supabasePayments ? '✅ MATCH' : '❌ MISMATCH'}\n`);
    
    // Check counteragents
    const localCounteragents = await localPrisma.counteragent.count();
    const supabaseCounteragents = await supabasePrisma.counteragent.count();
    
    console.log('📊 counteragents:');
    console.log(`   Local:    ${localCounteragents}`);
    console.log(`   Supabase: ${supabaseCounteragents}`);
    console.log(`   ${localCounteragents === supabaseCounteragents ? '✅ MATCH' : '❌ MISMATCH'}\n`);
    
    // Check projects
    const localProjects = await localPrisma.project.count();
    const supabaseProjects = await supabasePrisma.project.count();
    
    console.log('📊 projects:');
    console.log(`   Local:    ${localProjects}`);
    console.log(`   Supabase: ${supabaseProjects}`);
    console.log(`   ${localProjects === supabaseProjects ? '✅ MATCH' : '❌ MISMATCH'}\n`);
    
    // Summary
    console.log('\n📋 SUMMARY:');
    if (localBankTx === 0 && supabaseBankTx > 0) {
      console.log('⚠️  Local database appears to be empty or missing bank transaction data.');
      console.log('   You may need to copy data from Supabase to local.');
    } else if (localBankTx === supabaseBankTx) {
      console.log('✅ Databases are in sync!');
    } else {
      console.log('⚠️  Databases have different record counts.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await localPrisma.$disconnect();
    await supabasePrisma.$disconnect();
  }
}

compareData();
