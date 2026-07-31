const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  // Check transactions and their financial codes
  console.log('\n=== TRANSACTIONS WITH FINANCIAL CODES ===');
  const transactions = await prisma.$queryRawUnsafe(`
    SELECT 
      t.uuid, 
      t.payment_id,
      t.financial_code_uuid,
      fc.validation as financial_code,
      fc.is_income
    FROM "GE78BG0000000893486000_BOG_GEL" t
    LEFT JOIN financial_codes fc ON t.financial_code_uuid = fc.uuid
    WHERE t.project_uuid = $1::uuid
    ORDER BY t.transaction_date DESC
  `, projectUuid);
  
  console.log(JSON.stringify(transactions, null, 2));
  
  // Check what payments exist with this payment IDs
  console.log('\n=== PAYMENTS FOR THESE PAYMENT IDS ===');
  const paymentIds = transactions.map(t => t.payment_id).filter(Boolean);
  if (paymentIds.length > 0) {
    const payments = await prisma.payments.findMany({
      where: {
        payment_id: { in: paymentIds }
      },
      select: {
        payment_id: true,
        financial_code_uuid: true,
        financial_codes: {
          select: { validation: true, is_income: true }
        }
      }
    });
    console.log(JSON.stringify(payments, null, 2));
  } else {
    console.log('No payment IDs found');
  }
  
  // Check TBC_GEL transactions too
  console.log('\n=== TBC_GEL TRANSACTIONS ===');
  const tbcTx = await prisma.$queryRawUnsafe(`
    SELECT 
      t.uuid, 
      t.payment_id,
      t.financial_code_uuid,
      fc.validation as financial_code,
      fc.is_income
    FROM "GE65TB7856036050100002_TBC_GEL" t
    LEFT JOIN financial_codes fc ON t.financial_code_uuid = fc.uuid
    WHERE t.project_uuid = $1::uuid
  `, projectUuid);
  console.log(JSON.stringify(tbcTx, null, 2));
  
  await prisma.$disconnect();
}

check().catch(console.error);
