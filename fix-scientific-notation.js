const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🔧 Fixing records with scientific notation...\n');
    
    // Set all scientific notation values to NULL so they can be re-processed
    const result = await prisma.$executeRaw`
      UPDATE consolidated_bank_accounts
      SET 
        counteragent_account_number = NULL,
        updated_at = NOW()
      WHERE counteragent_account_number LIKE '%e+%' OR counteragent_account_number LIKE '%e-%'
    `;
    
    console.log(`✅ Set ${result} records to NULL (scientific notation removed)`);
    console.log('\n📋 These records now need to be re-synced from Supabase or raw data.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
