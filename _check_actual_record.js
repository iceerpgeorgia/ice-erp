const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRecord() {
  try {
    console.log('🔍 Checking payment record details in database...\n');

    // Query the exact record
    const payment = await prisma.$queryRawUnsafe(`
      SELECT 
        id,
        record_uuid,
        payment_id,
        counteragent_uuid,
        project_uuid,
        financial_code_uuid,
        currency_uuid,
        created_at,
        updated_at
      FROM payments
      WHERE id = 21497
    `);

    console.log('📋 Payment Record from DB ID 21497:\n');
    console.log('━'.repeat(70));
    if (payment && payment.length > 0) {
      const p = payment[0];
      console.log(`ID:                 ${p.id}`);
      console.log(`Record UUID:        ${p.record_uuid || '(EMPTY)'}`);
      console.log(`Payment ID:         ${p.payment_id}`);
      console.log(`Counteragent UUID:  ${p.counteragent_uuid}`);
      console.log(`Project UUID:       ${p.project_uuid}`);
      console.log(`Financial Code:     ${p.financial_code_uuid}`);
      console.log(`Currency UUID:      ${p.currency_uuid}`);
      console.log(`Created:            ${p.created_at}`);
      console.log(`Updated:            ${p.updated_at}`);
    } else {
      console.log('❌ No record found with ID 21497');
    }
    console.log('━'.repeat(70));

    // Also check by counteragent/project
    console.log('\n\n🔎 All payments for this counteragent/project:\n');
    console.log('━'.repeat(70));
    const allPayments = await prisma.$queryRawUnsafe(`
      SELECT 
        id,
        record_uuid,
        payment_id,
        created_at
      FROM payments
      WHERE counteragent_uuid = 'B4968862-3843-414D-9E73-1A7611618B41'
        AND project_uuid = 'CFFC1C06-B78B-45A0-8A02-37A23706EAFC'
      ORDER BY created_at DESC
    `);

    if (allPayments && allPayments.length > 0) {
      allPayments.forEach((p, idx) => {
        console.log(`${idx + 1}. ID: ${p.id}`);
        console.log(`   Record UUID: ${p.record_uuid || '(EMPTY)'}`);
        console.log(`   Payment ID:  ${p.payment_id}`);
        console.log(`   Created:     ${p.created_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No payments found');
    }
    console.log('━'.repeat(70));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecord();
