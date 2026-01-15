const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReverseLookupReadiness() {
  try {
    // Check transactions with all required fields
    const withAllFields = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM consolidated_bank_accounts
      WHERE counteragent_uuid IS NOT NULL 
      AND project_uuid IS NOT NULL 
      AND financial_code_uuid IS NOT NULL
      AND nominal_currency_uuid IS NOT NULL
    `;

    console.log('Transactions with all required fields for reverse lookup:', withAllFields[0].count);

    // Check how many have payment_id
    const withPaymentId = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM consolidated_bank_accounts
      WHERE payment_id IS NOT NULL
    `;

    console.log('Transactions with payment_id:', withPaymentId[0].count);

    // Sample transactions with all fields but no payment_id
    const samples = await prisma.$queryRaw`
      SELECT 
        counteragent_uuid,
        project_uuid,
        financial_code_uuid,
        nominal_currency_uuid,
        account_currency_uuid,
        payment_id,
        nominal_amount,
        description
      FROM consolidated_bank_accounts
      WHERE counteragent_uuid IS NOT NULL 
      AND project_uuid IS NOT NULL 
      AND financial_code_uuid IS NOT NULL
      AND nominal_currency_uuid IS NOT NULL
      AND payment_id IS NULL
      LIMIT 5
    `;

    console.log('\nSample transactions with all fields:');
    samples.forEach((tx, idx) => {
      console.log(`\n${idx + 1}. Amount: ${tx.nominal_amount}, Payment ID: ${tx.payment_id || 'NULL'}`);
      console.log(`   Counteragent: ${tx.counteragent_uuid}`);
      console.log(`   Project: ${tx.project_uuid}`);
      console.log(`   Financial Code: ${tx.financial_code_uuid}`);
      console.log(`   Currency: ${tx.nominal_currency_uuid}`);
    });

    // Check if there's a matching payment for one of these
    if (samples.length > 0) {
      const sample = samples[0];
      const matchingPayment = await prisma.$queryRaw`
        SELECT payment_id
        FROM payments
        WHERE counteragent_uuid = ${sample.counteragent_uuid}
        AND (project_uuid = ${sample.project_uuid} OR project_uuid IS NULL)
        AND financial_code_uuid = ${sample.financial_code_uuid}
        AND currency_uuid = ${sample.nominal_currency_uuid}
        LIMIT 1
      `;

      console.log('\n\nSearching for matching payment for sample #1...');
      if (matchingPayment.length > 0) {
        console.log('✅ Found matching payment:', matchingPayment[0].payment_id);
      } else {
        console.log('❌ No matching payment found');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkReverseLookupReadiness();
