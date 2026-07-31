const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  // Check TBC_GEL transactions in detail
  console.log('\n=== TBC_GEL TRANSACTIONS (GE65TB7856036050100002_TBC_GEL) ===');
  const tbcTx = await prisma.$queryRawUnsafe(`
    SELECT 
      t.uuid,
      t.raw_record_uuid,
      t.payment_id,
      t.financial_code_uuid,
      t.account_currency_amount,
      t.nominal_amount,
      t.transaction_date,
      fc.validation as financial_code,
      fc.is_income
    FROM "GE65TB7856036050100002_TBC_GEL" t
    LEFT JOIN financial_codes fc ON t.financial_code_uuid = fc.uuid
    WHERE t.project_uuid = $1::uuid
  `, projectUuid);
  
  console.log(JSON.stringify(tbcTx, null, 2));
  
  if (tbcTx.length > 0) {
    const tx = tbcTx[0];
    console.log(`\n=== ANALYSIS ===`);
    console.log(`Payment ID: ${tx.payment_id}`);
    console.log(`Financial Code: ${tx.financial_code}`);
    console.log(`Is Income: ${tx.is_income}`);
    console.log(`Amount (Account Currency): ${tx.account_currency_amount}`);
    console.log(`Amount (Nominal): ${tx.nominal_amount}`);
    
    // Check if this payment exists in payments table
    console.log(`\n=== PAYMENT LOOKUP ===`);
    const payment = await prisma.payments.findFirst({
      where: { payment_id: tx.payment_id }
    });
    console.log(payment ? `Found payment: ${payment.payment_id}` : 'Payment not found in payments table');
  }
  
  // Also check BOG table for comparison
  console.log('\n\n=== BOG_GEL TRANSACTIONS (GE78BG0000000893486000_BOG_GEL) ===');
  const bogTx = await prisma.$queryRawUnsafe(`
    SELECT 
      uuid,
      payment_id,
      financial_code_uuid,
      account_currency_amount,
      nominal_amount,
      fc.validation as financial_code,
      fc.is_income
    FROM "GE78BG0000000893486000_BOG_GEL" t
    LEFT JOIN financial_codes fc ON t.financial_code_uuid = fc.uuid
    WHERE t.project_uuid = $1::uuid
    LIMIT 1
  `, projectUuid);
  
  console.log(JSON.stringify(bogTx, null, 2));
  
  await prisma.$disconnect();
}

check().catch(console.error);
