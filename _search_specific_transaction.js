const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const table = 'GE65TB7856036050100002_TBC_GEL';
  const targetDate = '2019-11-05';
  const targetAmount = 100578.80;
  
  try {
    // Search by exact date and amount
    const sql = `SELECT * FROM "${table}" 
                 WHERE transaction_date = '${targetDate}'
                 ORDER BY transaction_date DESC`;
    
    const results = await prisma.$queryRawUnsafe(sql);
    
    console.log(`\nSearching in ${table}`);
    console.log(`Date: ${targetDate}`);
    console.log(`Amount: ${targetAmount} GEL\n`);
    
    if (results.length === 0) {
      console.log('❌ No transactions found on that date.');
      
      // Try searching for similar amounts in nearby dates
      console.log('\n--- Searching for similar amounts in nearby dates ---\n');
      const fuzzySQL = `SELECT uuid, transaction_date, entrylacct, entrydbamt, entrycramt, doccomment, docnomination, counteragent_uuid, payment_id
                        FROM "${table}"
                        WHERE transaction_date BETWEEN '2019-11-01' AND '2019-11-10'
                        ORDER BY transaction_date DESC`;
      
      const fuzzyResults = await prisma.$queryRawUnsafe(fuzzySQL);
      if (fuzzyResults.length > 0) {
        console.log(`Found ${fuzzyResults.length} transactions in nearby date range (2019-11-01 to 2019-11-10):\n`);
        fuzzyResults.forEach(row => {
          console.log(`  Date: ${row.transaction_date}`);
          console.log(`  Account: ${row.entrylacct}`);
          console.log(`  Debit: ${row.entrydbamt} | Credit: ${row.entrycramt}`);
          console.log(`  Comment: ${row.doccomment}`);
          console.log(`  Doc: ${row.docnomination}`);
          console.log(`  Counteragent: ${row.counteragent_uuid}`);
          console.log(`  Payment ID: ${row.payment_id}`);
          console.log('  ---');
        });
      } else {
        console.log('No transactions found in nearby date range either.');
      }
    } else {
      console.log(`✓ Found ${results.length} transaction(s) on ${targetDate}:\n`);
      results.forEach((row, idx) => {
        const matchAmount = Math.abs((row.entrydbamt || 0) - targetAmount) < 0.01 || 
                           Math.abs((row.entrycramt || 0) - targetAmount) < 0.01;
        const marker = matchAmount ? '✓✓✓ MATCH ✓✓✓' : '';
        
        console.log(`Transaction ${idx + 1} ${marker}`);
        console.log(`  UUID: ${row.uuid}`);
        console.log(`  Date: ${row.transaction_date}`);
        console.log(`  Debit Amount: ${row.entrydbamt}`);
        console.log(`  Credit Amount: ${row.entrycramt}`);
        console.log(`  Account: ${row.entrylacct}`);
        console.log(`  Doc: ${row.docnomination}`);
        console.log(`  Comment: ${row.doccomment}`);
        console.log(`  Counteragent: ${row.counteragent_uuid}`);
        console.log(`  Payment ID: ${row.payment_id}`);
        console.log('  ---');
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  await prisma.$disconnect();
})();
