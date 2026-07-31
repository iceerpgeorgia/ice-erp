const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DOCKEY = '31729032287';
const ENTRIESID = '110651720035';

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
    console.log(`Searching for transaction:\n  DocKey: ${DOCKEY}\n  EntriesId: ${ENTRIESID}\n`);
    
    // Search each raw table
    for (const table of RAW_TABLES) {
      const query = `SELECT * FROM "${table}" WHERE dockey = $1 AND entriesid = $2 LIMIT 1`;
      try {
        const result = await prisma.$queryRawUnsafe(query, DOCKEY, ENTRIESID);
        if (result && result.length > 0) {
          const row = result[0];
          console.log(`✓ Found in table: ${table}`);
          console.log(`  ID: ${row.id}`);
          console.log(`  UUID: ${row.uuid}`);
          console.log(`  Raw Record UUID: ${row.raw_record_uuid || '(NULL)'}`);
          console.log(`  Project UUID: ${row.project_uuid || '(NULL)'}`);
          console.log(`  Payment ID: ${row.payment_id || '(NULL)'}`);
          console.log(`  Financial Code UUID: ${row.financial_code_uuid || '(NULL)'}`);
          console.log(`  Counteragent UUID: ${row.counteragent_uuid || '(NULL)'}`);
          console.log(`  Description: ${row.description}`);
          console.log(`  Account Currency Amount: ${row.account_currency_amount}`);
          console.log(`  Nominal Amount: ${row.nominal_amount}`);
          console.log(`  Is Processed: ${row.is_processed || false}`);
          console.log(`  Processing Case: ${row.processing_case || '(NULL)'}`);
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
