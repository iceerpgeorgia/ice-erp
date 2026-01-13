const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🔍 Finding records with scientific notation in counteragent_account_number...\n');
    
    // Find all records with 'e+' or 'e-' in the account number (scientific notation)
    const badRecords = await prisma.$queryRaw`
      SELECT id, counteragent_account_number
      FROM consolidated_bank_accounts
      WHERE counteragent_account_number LIKE '%e+%' OR counteragent_account_number LIKE '%e-%'
    `;
    
    console.log(`Found ${badRecords.length} records with scientific notation\n`);
    
    if (badRecords.length === 0) {
      console.log('✅ No records need fixing!');
      return;
    }
    
    console.log('Sample bad records:');
    badRecords.slice(0, 5).forEach(r => {
      console.log(`  ID ${Number(r.id)}: ${r.counteragent_account_number}`);
    });
    
    console.log('\n❌ These records have corrupted account numbers stored as scientific notation.');
    console.log('📋 They need to be re-synced from Supabase or the raw data.');
    console.log('\nOptions:');
    console.log('1. Set them to NULL so they can be re-processed');
    console.log('2. Re-sync from Supabase with proper string handling');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
