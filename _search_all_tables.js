const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const targetAmount = 100578.80;
const tolerance = 1; // Allow 1 GEL difference

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
  console.log(`\nSearching for amount: ${targetAmount} GEL (±${tolerance} tolerance)\n`);
  console.log('='.repeat(80));
  
  let globalCount = 0;
  const foundTransactions = [];
  
  for (const table of tables) {
    try {
      const sql = `SELECT uuid, transaction_date, entrylacct, entrydbamt, entrycramt, docnomination, counteragent_uuid, payment_id, doccomment
                   FROM "${table}"
                   WHERE (CAST(entrydbamt AS DECIMAL) BETWEEN ${targetAmount - tolerance} AND ${targetAmount + tolerance}
                          OR CAST(entrycramt AS DECIMAL) BETWEEN ${targetAmount - tolerance} AND ${targetAmount + tolerance})
                   ORDER BY transaction_date DESC`;
      
      const results = await prisma.$queryRawUnsafe(sql);
      
      if (results.length > 0) {
        console.log(`\n✓ ${table}: FOUND ${results.length} transaction(s)\n`);
        globalCount += results.length;
        
        results.forEach((row, idx) => {
          const amount = row.entrydbamt || row.entrycramt;
          const type = row.entrydbamt ? 'DEBIT' : 'CREDIT';
          console.log(`  ${idx + 1}. Date: ${row.transaction_date} | Amount: ${amount} GEL (${type})`);
          console.log(`     Doc: ${row.docnomination}`);
          console.log(`     Counteragent: ${row.counteragent_uuid}`);
          console.log(`     Payment ID: ${row.payment_id}`);
          console.log(`     UUID: ${row.uuid}`);
          
          foundTransactions.push({
            table,
            date: row.transaction_date,
            amount,
            type,
            docnomination: row.docnomination,
            counteragent_uuid: row.counteragent_uuid,
            payment_id: row.payment_id,
            uuid: row.uuid
          });
        });
      }
      
    } catch (error) {
      console.log(`⚠ ${table}: Error - ${error.message.split('\n')[0]}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\nTOTAL FOUND: ${globalCount} transaction(s) with amount ~${targetAmount} GEL across all tables\n`);
  
  if (globalCount === 0) {
    console.log('🔍 No exact matches found. Searching for similar amounts (within ±10,000 GEL)...\n');
    
    for (const table of tables) {
      try {
        const sql = `SELECT COUNT(*) as count FROM "${table}"
                     WHERE (CAST(entrydbamt AS DECIMAL) BETWEEN ${targetAmount - 10000} AND ${targetAmount + 10000}
                            OR CAST(entrycramt AS DECIMAL) BETWEEN ${targetAmount - 10000} AND ${targetAmount + 10000})`;
        
        const result = await prisma.$queryRawUnsafe(sql);
        const count = parseInt(result[0].count, 10);
        
        if (count > 0) {
          console.log(`  ${table}: ${count} transactions in range [${targetAmount - 10000}, ${targetAmount + 10000}]`);
        }
      } catch (error) {
        // Silently skip errors
      }
    }
  }
  
  await prisma.$disconnect();
})();
