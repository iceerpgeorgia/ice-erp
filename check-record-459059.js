// Check specific transaction record for currency conversion
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking transaction ID 459059 and nearby records...\n');
  
  // Get the specific record and some nearby ones
  const transactions = await prisma.$queryRaw`
    SELECT 
      cba.id,
      cba.transaction_date,
      cba.account_currency_amount,
      cba.nominal_amount,
      cba.nominal_currency_uuid,
      cba.payment_id,
      ba.account_number,
      ba_curr.code as account_currency,
      nom_curr.code as nominal_currency,
      raw.ccyrate,
      raw.docinformation,
      raw.docnomination
    FROM consolidated_bank_accounts cba
    JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
    JOIN currencies ba_curr ON ba.currency_uuid = ba_curr.uuid
    LEFT JOIN currencies nom_curr ON cba.nominal_currency_uuid = nom_curr.uuid
    LEFT JOIN bog_gel_raw_893486000 raw ON cba.raw_record_uuid = raw.uuid
    WHERE cba.id BETWEEN 459055 AND 459065
    ORDER BY cba.id
  `;
  
  console.log(`Found ${transactions.length} transactions:\n`);
  
  for (const txn of transactions) {
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`Transaction ID: ${txn.id}`);
    console.log(`Date: ${txn.transaction_date}`);
    console.log(`Account: ${txn.account_number} (${txn.account_currency})`);
    console.log(`Description: ${txn.docnomination || 'N/A'}`);
    console.log(`\nAmounts:`);
    console.log(`  Account Currency Amount: ${txn.account_currency_amount} ${txn.account_currency}`);
    console.log(`  Nominal Amount: ${txn.nominal_amount} ${txn.nominal_currency || txn.account_currency}`);
    console.log(`  Nominal Currency: ${txn.nominal_currency || txn.account_currency}`);
    
    if (txn.ccyrate) {
      console.log(`\nFrom XML:`);
      console.log(`  CcyRate: ${txn.ccyrate}`);
    }
    
    if (txn.payment_id) {
      console.log(`\nPayment ID: ${txn.payment_id}`);
    }
    
    // Check if conversion looks right
    if (txn.account_currency !== txn.nominal_currency && txn.nominal_currency) {
      console.log(`\n⚠️  Currency mismatch detected:`);
      console.log(`   Account: ${txn.account_currency} → Nominal: ${txn.nominal_currency}`);
      console.log(`   This transaction needs currency conversion`);
      
      // Try to get NBG rate for this date
      const dateStr = new Date(txn.transaction_date).toISOString().split('T')[0];
      const rateQuery = await prisma.$queryRaw`
        SELECT usd_rate, eur_rate, gbp_rate, cny_rate, rub_rate, try_rate, aed_rate, kzt_rate
        FROM nbg_exchange_rates
        WHERE date = ${dateStr}::date
      `;
      
      if (rateQuery.length > 0) {
        const rates = rateQuery[0];
        const currencyKey = txn.nominal_currency.toLowerCase() + '_rate';
        const rate = rates[currencyKey];
        
        if (rate) {
          console.log(`\nNBG Rate for ${dateStr}:`);
          console.log(`   ${txn.nominal_currency} rate: ${rate}`);
          
          const expectedNominal = parseFloat(txn.account_currency_amount) * (1 / parseFloat(rate));
          const actualNominal = parseFloat(txn.nominal_amount);
          
          console.log(`\nCalculation Check:`);
          console.log(`   Expected: ${txn.account_currency_amount} * (1 / ${rate}) = ${expectedNominal.toFixed(2)}`);
          console.log(`   Actual: ${actualNominal.toFixed(2)}`);
          console.log(`   Match: ${Math.abs(expectedNominal - actualNominal) < 0.01 ? '✅' : '❌'}`);
        }
      }
    } else if (txn.account_currency === 'GEL' && (!txn.nominal_currency || txn.nominal_currency === 'GEL')) {
      console.log(`\n✅ GEL → GEL: No conversion needed`);
    }
    
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
