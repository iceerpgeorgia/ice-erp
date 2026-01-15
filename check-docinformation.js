const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPaymentIdInBankTransactions() {
  try {
    // Check if payment_id is populated in consolidated_bank_accounts
    const withPaymentId = await prisma.$queryRaw`
      SELECT 
        cba.uuid,
        cba.payment_id,
        cba.description,
        cba.nominal_amount,
        cba.transaction_date,
        raw.docinformation,
        raw.docnomination
      FROM consolidated_bank_accounts cba
      JOIN bog_gel_raw_893486000 raw ON cba.raw_record_uuid = raw.uuid
      WHERE cba.transaction_date = '26.12.2025'
      AND cba.nominal_amount::text LIKE '%5123.54%'
      LIMIT 1
    `;

    console.log('Transaction with $5,123.54 on 26.12.2025:');
    console.log(JSON.stringify(withPaymentId, null, 2));

    // Check a few more transactions
    const sample = await prisma.$queryRaw`
      SELECT 
        cba.payment_id,
        cba.description,
        cba.nominal_amount,
        raw.docinformation
      FROM consolidated_bank_accounts cba
      JOIN bog_gel_raw_893486000 raw ON cba.raw_record_uuid = raw.uuid
      LIMIT 10
    `;

    console.log('\n\nSample transactions DocInformation:');
    sample.forEach((tx, idx) => {
      console.log(`\n${idx + 1}. Amount: ${tx.nominal_amount}, Payment ID: ${tx.payment_id || 'NULL'}`);
      console.log(`   DocInformation: ${tx.docinformation || 'NULL'}`);
      console.log(`   Description: ${tx.description || 'NULL'}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPaymentIdInBankTransactions();
