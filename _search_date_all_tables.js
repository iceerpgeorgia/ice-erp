const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const targetDate = '2019-11-05';

const tables = [
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
  'GE52TB7856045067800005_TBC_GEL'
];

(async () => {
  console.log(`\nSearching for transactions dated: ${targetDate}\n`);
  console.log('='.repeat(100));
  
  let globalCount = 0;
  
  for (const table of tables) {
    try {
      const sql = `SELECT uuid, transaction_date, entrydbamt, entrycramt, docnomination, counteragent_uuid, payment_id
                   FROM "${table}"
                   WHERE transaction_date = '${targetDate}'
                   ORDER BY CAST(entrydbamt AS DECIMAL) DESC NULLS LAST`;
      
      const results = await prisma.$queryRawUnsafe(sql);
      
      if (results.length > 0) {
        console.log(`\n✓ ${table}: ${results.length} transaction(s)\n`);
        globalCount += results.length;
        
        results.forEach((row, idx) => {
          const amount = row.entrydbamt || row.entrycramt;
          const type = row.entrydbamt ? 'DEBIT' : 'CREDIT';
          console.log(`  ${idx + 1}. ${amount} GEL (${type}) | ${row.docnomination}`);
        });
      }
      
    } catch (error) {
      // Skip errors silently
    }
  }
  
  console.log('\n' + '='.repeat(100));
  console.log(`\nTOTAL TRANSACTIONS on ${targetDate}: ${globalCount}\n`);
  
  await prisma.$disconnect();
})();
