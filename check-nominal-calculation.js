// Verify nominal amounts are calculated correctly using exchange rates
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking nominal_amount calculation with exchange rates...\n');
  
  // Get sample transactions
  const transactions = await prisma.$queryRaw`
    SELECT 
      cba.id,
      cba.transaction_date,
      cba.account_currency_amount,
      cba.nominal_amount,
      cba.payment_id,
      raw.ccyrate,
      c.code as currency_code
    FROM consolidated_bank_accounts cba
    JOIN bog_gel_raw_893486000 raw ON cba.raw_record_uuid = raw.uuid
    JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
    JOIN currencies c ON ba.currency_uuid = c.uuid
    WHERE cba.account_currency_amount != cba.nominal_amount
    ORDER BY cba.id DESC
    LIMIT 10
  `;
  
  console.log(`Found ${transactions.length} transactions where nominal_amount ≠ account_currency_amount:\n`);
  
  transactions.forEach((txn, idx) => {
    console.log(`Transaction ${idx + 1}:`);
    console.log(`  ID: ${txn.id}`);
    console.log(`  Date: ${txn.transaction_date}`);
    console.log(`  Currency: ${txn.currency_code}`);
    console.log(`  CcyRate: ${txn.ccyrate}`);
    console.log(`  Account Currency Amount: ${txn.account_currency_amount}`);
    console.log(`  Nominal Amount: ${txn.nominal_amount}`);
    
    if (txn.ccyrate && txn.ccyrate !== '0') {
      const rate = parseFloat(txn.ccyrate);
      const expected = parseFloat(txn.account_currency_amount) * (1 / rate);
      const actual = parseFloat(txn.nominal_amount);
      const match = Math.abs(expected - actual) < 0.01;
      console.log(`  Expected (amount * 1/rate): ${expected.toFixed(2)}`);
      console.log(`  Match: ${match ? '✅' : '❌'}`);
    }
    console.log('');
  });
  
  // Get statistics
  const stats = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN account_currency_amount = nominal_amount THEN 1 END) as equal_amounts,
      COUNT(CASE WHEN account_currency_amount != nominal_amount THEN 1 END) as different_amounts
    FROM consolidated_bank_accounts
  `;
  
  console.log('Summary:');
  console.log(`  Total transactions: ${stats[0].total}`);
  console.log(`  Equal amounts: ${stats[0].equal_amounts} (${((stats[0].equal_amounts/stats[0].total)*100).toFixed(2)}%)`);
  console.log(`  Different amounts: ${stats[0].different_amounts} (${((stats[0].different_amounts/stats[0].total)*100).toFixed(2)}%)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
