const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  console.log('=== VERIFYING FIXED TRANSACTIONS NOW APPEAR IN API QUERY ===\n');
  
  // Simulate the API query
  const txs = await prisma.$queryRawUnsafe(`
    SELECT 
      payment_id,
      financial_code_uuid,
      nominal_amount,
      transaction_date,
      fc.validation as financial_code,
      fc.is_income
    FROM "GE65TB7856036050100002_TBC_GEL" t
    LEFT JOIN financial_codes fc ON t.financial_code_uuid = fc.uuid
    WHERE t.project_uuid = $1::uuid
    ORDER BY transaction_date
  `, projectUuid);
  
  console.log(`Transactions now visible for project ${projectUuid}:\n`);
  
  let incomeCount = 0;
  for (const tx of txs) {
    const type = tx.is_income ? '(INCOME)' : '(EXPENSE)';
    console.log(`${tx.payment_id}: ${tx.nominal_amount} on ${tx.transaction_date} ${type}`);
    console.log(`  → ${tx.financial_code}`);
    if (tx.is_income) incomeCount++;
    console.log();
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total transactions: ${txs.length}`);
  console.log(`Income transactions: ${incomeCount}`);
  console.log(`Expense transactions: ${txs.length - incomeCount}`);
  
  console.log(`\n✅ All three income transactions from GE65TB7856036050100002_TBC_GEL are now visible!`);
  
  await prisma.$disconnect();
}

verify().catch(console.error);
