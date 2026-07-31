const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const counteragentUuid = 'b4968862-3843-414d-9e73-1a7611618b41';
const tables = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

(async () => {
  console.log(`Searching for transactions with counteragent: ${counteragentUuid}\n`);
  
  for (const table of tables) {
    try {
      const sql = `SELECT COUNT(*) as count FROM "${table}" WHERE counteragent_uuid = '${counteragentUuid}'`;
      const result = await prisma.$queryRawUnsafe(sql);
      const count = parseInt(result[0].count, 10);
      
      if (count > 0) {
        console.log(`\n✓ ${table}: ${count} transactions\n`);
        
        // Get all columns for this transaction
        const detailSql = `SELECT * FROM "${table}" WHERE counteragent_uuid = '${counteragentUuid}' ORDER BY transaction_date DESC LIMIT 3`;
        const details = await prisma.$queryRawUnsafe(detailSql);
        
        if (details.length > 0) {
          console.log('First transaction columns:', Object.keys(details[0]).join(', '));
          console.log('\nSample transactions:');
          details.forEach((row, idx) => {
            console.log(`\n  Transaction ${idx + 1}:`);
            console.log(`    Date: ${row.transaction_date}`);
            console.log(`    UUID: ${row.uuid}`);
            console.log(`    Counteragent: ${row.counteragent_uuid}`);
            console.log(`    Payment ID: ${row.payment_id}`);
            console.log(`    Doc: ${row.docnomination || 'N/A'}`);
            if (row.amount) console.log(`    Amount: ${row.amount}`);
            if (row.debit) console.log(`    Debit: ${row.debit}`);
            if (row.credit) console.log(`    Credit: ${row.credit}`);
            console.log(`    Currency: ${row.currency_code || 'N/A'}`);
          });
        }
      }
    } catch (error) {
      console.log(`⚠ ${table}: Error - ${error.message}`);
    }
  }
  
  await prisma.$disconnect();
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
