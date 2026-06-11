const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TX_UUID = '3ca0c418-67a3-58cb-a249-fab2df655909';

// List of raw table names from the API
const RAW_TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE74BG0000000586388146_BOG_USD',
  'GE78BG0000000893486000_BOG_USD',
  'GE78BG0000000893486000_BOG_EUR',
  'GE78BG0000000893486000_BOG_AED',
  'GE78BG0000000893486000_BOG_GBP',
  'GE78BG0000000893486000_BOG_KZT',
  'GE78BG0000000893486000_BOG_CNY',
  'GE78BG0000000893486000_BOG_TRY',
  'GE65TB7856036050100002_TBC_GEL',
  'GE39TB7856036150100001_TBC_USD',
  'GE39TB7856036150100001_TBC_EUR',
  'GE79TB7856045067800004_TBC_GEL',
  'GE52TB7856045067800005_TBC_GEL',
];

(async () => {
  try {
    console.log(`Searching for transaction UUID: ${TX_UUID}\n`);
    
    // Search each raw table
    for (const table of RAW_TABLES) {
      const query = `SELECT * FROM "${table}" WHERE uuid = $1 LIMIT 1`;
      try {
        const result = await prisma.$queryRawUnsafe(query, TX_UUID);
        if (result && result.length > 0) {
          const row = result[0];
          console.log(`✓ Found in table: ${table}`);
          console.log(`  ID: ${row.id}`);
          console.log(`  UUID: ${row.uuid}`);
          console.log(`  Project UUID: ${row.project_uuid || '(NULL)'}`);
          console.log(`  Payment ID: ${row.payment_id || '(NULL)'}`);
          console.log(`  Financial Code UUID: ${row.financial_code_uuid || '(NULL)'}`);
          console.log(`  Description: ${row.description}`);
          console.log(`  Amount: ${row.account_currency_amount} ${row.account_currency_uuid || '?'}`);
          console.log('');
          break;
        }
      } catch (e) {
        // Table might not exist, skip
      }
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await prisma.$disconnect();
})();
