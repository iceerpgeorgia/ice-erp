const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const table = 'GE65TB7856036050100002_TBC_GEL';
  const targetAmount = 100578.80;
  const tolerance = 1; // Allow 1 GEL difference
  
  try {
    console.log(`\nSearching in ${table}`);
    console.log(`Looking for amount: ${targetAmount} GEL (±${tolerance} tolerance)\n`);
    
    // Search with proper casting
    const sql = `SELECT uuid, transaction_date, entrylacct, entrydbamt, entrycramt, doccomment, docnomination, counteragent_uuid, payment_id
                 FROM "${table}"
                 WHERE (CAST(entrydbamt AS DECIMAL) BETWEEN ${targetAmount - tolerance} AND ${targetAmount + tolerance}
                        OR CAST(entrycramt AS DECIMAL) BETWEEN ${targetAmount - tolerance} AND ${targetAmount + tolerance})
                 ORDER BY transaction_date DESC`;
    
    const results = await prisma.$queryRawUnsafe(sql);
    
    if (results.length === 0) {
      console.log('❌ No transactions found with amount ~100,578.80 GEL\n');
      
      // Try broader search
      console.log('--- Searching for larger amounts (>50,000 GEL) ---\n');
      const largeSql = `SELECT uuid, transaction_date, entrylacct, entrydbamt, entrycramt, docnomination
                        FROM "${table}"
                        WHERE CAST(entrydbamt AS DECIMAL) > 50000 OR CAST(entrycramt AS DECIMAL) > 50000
                        ORDER BY CAST(entrydbamt AS DECIMAL) DESC NULLS LAST
                        LIMIT 20`;
      
      const largeResults = await prisma.$queryRawUnsafe(largeSql);
      console.log(`Found ${largeResults.length} large transactions (>50,000 GEL):\n`);
      largeResults.forEach(row => {
        const amount = row.entrydbamt || row.entrycramt;
        console.log(`  ${row.transaction_date} | ${amount} GEL | ${row.docnomination}`);
      });
      
    } else {
      console.log(`✓ FOUND ${results.length} transaction(s):\n`);
      results.forEach((row, idx) => {
        console.log(`${idx + 1}. Date: ${row.transaction_date}`);
        console.log(`   Debit: ${row.entrydbamt} | Credit: ${row.entrycramt}`);
        console.log(`   Doc: ${row.docnomination}`);
        console.log(`   Counteragent: ${row.counteragent_uuid}`);
        console.log(`   UUID: ${row.uuid}\n`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  await prisma.$disconnect();
})();
