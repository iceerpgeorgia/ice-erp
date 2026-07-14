const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const counteragentUuid = 'b4968862-3843-414d-9e73-1a7611618b41';
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
  let totalCount = 0;
  console.log(`Searching for transactions with counteragent: ${counteragentUuid}\n`);
  
  for (const table of tables) {
    try {
      const sql = `SELECT COUNT(*) as count FROM "${table}" WHERE counteragent_uuid = '${counteragentUuid}'`;
      const result = await prisma.$queryRawUnsafe(sql);
      const count = parseInt(result[0].count, 10);
      
      if (count > 0) {
        console.log(`✓ ${table}: ${count} transactions`);
        totalCount += count;
        
        const detailSql = `SELECT uuid, transaction_date, amount, currency_code, payment_id, docnomination FROM "${table}" WHERE counteragent_uuid = '${counteragentUuid}' ORDER BY transaction_date DESC LIMIT 5`;
        const details = await prisma.$queryRawUnsafe(detailSql);
        console.log('  Sample transactions:');
        details.forEach(row => {
          console.log(`    - ${row.transaction_date} | ${row.amount} ${row.currency_code} | Payment: ${row.payment_id} | Doc: ${row.docnomination}`);
        });
        console.log('');
      }
    } catch (error) {
      console.log(`⚠ ${table}: Error - ${error.message}`);
    }
  }
  
  console.log(`\n=====================================`);
  console.log(`TOTAL: ${totalCount} transactions found`);
  console.log(`=====================================`);
  
  await prisma.$disconnect();
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
