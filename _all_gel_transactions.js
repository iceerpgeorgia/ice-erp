const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const targetDate = '2019-11-05';

// Only GEL tables
const gelTables = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
  'GE79TB7856045067800004_TBC_GEL',
  'GE52TB7856045067800005_TBC_GEL'
];

(async () => {
  console.log(`\n${'='.repeat(120)}`);
  console.log(`ALL TRANSACTIONS IN GEL ACCOUNTS ON: ${targetDate}`);
  console.log(`${'='.repeat(120)}\n`);
  
  let globalCount = 0;
  const allTransactions = [];
  
  for (const table of gelTables) {
    try {
      const sql = `SELECT uuid, transaction_date, entrydbamt, entrycramt, docnomination, counteragent_uuid, payment_id, docsenderinn, docbenefinn, doccomment
                   FROM "${table}"
                   WHERE transaction_date = '${targetDate}'
                   ORDER BY CAST(entrydbamt AS DECIMAL) DESC NULLS LAST, transaction_date`;
      
      const results = await prisma.$queryRawUnsafe(sql);
      
      if (results.length > 0) {
        console.log(`\n📊 ${table.padEnd(45)} [${results.length} transactions]\n`);
        globalCount += results.length;
        
        results.forEach((row, idx) => {
          const amount = row.entrydbamt || row.entrycramt;
          const type = row.entrydbamt ? 'DEBIT' : 'CREDIT';
          
          allTransactions.push({
            table,
            index: idx + 1,
            amount: parseFloat(amount),
            type,
            date: row.transaction_date,
            docnomination: row.docnomination,
            counteragent_uuid: row.counteragent_uuid,
            payment_id: row.payment_id,
            uuid: row.uuid
          });
          
          console.log(`  ${String(idx + 1).padStart(3)}. ${String(parseFloat(amount)).padStart(12)} GEL (${type.padEnd(6)}) | ${row.docnomination.substring(0, 70)}`);
          if (row.counteragent_uuid) {
            console.log(`      └─ Counteragent: ${row.counteragent_uuid}`);
          }
        });
      }
      
    } catch (error) {
      console.log(`⚠ ${table}: Error - ${error.message.split('\n')[0]}`);
    }
  }
  
  // Summary stats
  console.log(`\n${'='.repeat(120)}`);
  console.log(`\n📈 SUMMARY STATISTICS`);
  console.log(`${'='.repeat(120)}\n`);
  
  const debits = allTransactions.filter(t => t.type === 'DEBIT');
  const credits = allTransactions.filter(t => t.type === 'CREDIT');
  
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0);
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0);
  
  console.log(`Total Transactions:      ${globalCount}`);
  console.log(`  - Debit Transactions:  ${debits.length} (Total: ${totalDebits.toFixed(2)} GEL)`);
  console.log(`  - Credit Transactions: ${credits.length} (Total: ${totalCredits.toFixed(2)} GEL)`);
  console.log(`\nLargest Transaction:     ${Math.max(...allTransactions.map(t => t.amount)).toFixed(2)} GEL`);
  console.log(`Smallest Transaction:    ${Math.min(...allTransactions.map(t => t.amount)).toFixed(2)} GEL`);
  console.log(`Average Transaction:     ${(allTransactions.reduce((sum, t) => sum + t.amount, 0) / globalCount).toFixed(2)} GEL`);
  
  console.log(`\n${'='.repeat(120)}\n`);
  
  await prisma.$disconnect();
})();
