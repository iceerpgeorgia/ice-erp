// Check transactions with USD nominal currency (GEL → USD conversion)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking GEL → USD currency conversions...\n');
  
  const transactions = await prisma.$queryRaw`
    SELECT 
      cba.id,
      cba.transaction_date,
      cba.account_currency_amount,
      cba.nominal_amount,
      cba.payment_id,
      ba.account_number,
      ba_curr.code as account_currency,
      nom_curr.code as nominal_currency,
      cba.description
    FROM consolidated_bank_accounts cba
    JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
    JOIN currencies ba_curr ON ba.currency_uuid = ba_curr.uuid
    JOIN currencies nom_curr ON cba.nominal_currency_uuid = nom_curr.uuid
    WHERE ba_curr.code = 'GEL' 
      AND nom_curr.code = 'USD'
      AND cba.payment_id IS NOT NULL
    ORDER BY cba.id DESC
    LIMIT 5
  `;
  
  console.log(`Found ${transactions.length} GEL → USD transactions:\n`);
  
  for (const txn of transactions) {
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`Transaction ID: ${txn.id}`);
    console.log(`Date: ${txn.transaction_date}`);
    console.log(`Payment ID: ${txn.payment_id}`);
    console.log(`Description: ${txn.description.substring(0, 60)}...`);
    console.log(`\nConversion:`);
    console.log(`  ${txn.account_currency_amount} GEL → ${txn.nominal_amount} USD`);
    
    // Get NBG rate for this date
    const dateStr = new Date(txn.transaction_date).toISOString().split('T')[0];
    const rateQuery = await prisma.$queryRaw`
      SELECT usd_rate
      FROM nbg_exchange_rates
      WHERE date = ${dateStr}::date
    `;
    
    if (rateQuery.length > 0) {
      const rate = parseFloat(rateQuery[0].usd_rate);
      const expected = parseFloat(txn.account_currency_amount) / rate;
      const actual = parseFloat(txn.nominal_amount);
      const diff = Math.abs(expected - actual);
      
      console.log(`\nNBG USD Rate (${dateStr}): ${rate}`);
      console.log(`Formula: ${txn.account_currency_amount} GEL / ${rate} = ${expected.toFixed(2)} USD`);
      console.log(`Actual stored: ${actual.toFixed(2)} USD`);
      console.log(`Difference: ${diff.toFixed(4)}`);
      console.log(`Match: ${diff < 0.01 ? '✅ CORRECT' : '❌ INCORRECT'}`);
    }
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
