const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
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
    'GE52TB7856045067800005_TBC_GEL',
  ];

  let totalCount = 0;
  const results = [];

  console.log(`\nSearching for counteragent: ${counteragentUuid}\n`);

  for (const table of tables) {
    try {
      const countQuery = `SELECT COUNT(*) as count FROM "${table}" WHERE counteragent_uuid = $1`;
      const countResult = await prisma.$queryRawUnsafe(countQuery, counteragentUuid);
      const count = countResult[0]?.count || 0;
      
      if (count > 0) {
        const transactionsQuery = `
          SELECT 
            id, 
            uuid, 
            raw_record_uuid, 
            transaction_date, 
            description, 
            payment_id, 
            counteragent_uuid, 
            account_currency_amount, 
            nominal_amount,
            account_currency_uuid,
            nominal_currency_uuid
          FROM "${table}" 
          WHERE counteragent_uuid = $1 
          ORDER BY transaction_date DESC 
          LIMIT 10
        `;
        const transactions = await prisma.$queryRawUnsafe(transactionsQuery, counteragentUuid);
        
        results.push({
          table,
          count,
          samples: transactions
        });
        totalCount += count;
        console.log(`✓ ${table}: ${count} transactions found`);
      }
    } catch (e) {
      console.log(`✗ Error querying ${table}: ${e.message}`);
    }
  }

  console.log(`\n=== SUMMARY ===\nTotal transactions found: ${totalCount}\n`);
  console.log(JSON.stringify(results, null, 2));
  
  await prisma.$disconnect();
})();
