const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const incomePaymentIds = ['500f5c_cb_4201d1', '744590_16_a6d0c4', '9b906c_11_539eba'];
  
  for (const paymentId of incomePaymentIds) {
    console.log(`\n=== TRANSACTION FOR PAYMENT ${paymentId} ===`);
    const tx = await prisma.$queryRawUnsafe(`
      SELECT 
        t.uuid,
        t.payment_id,
        t.financial_code_uuid,
        t.nominal_amount,
        t.account_currency_amount,
        t.transaction_date,
        t.project_uuid,
        fc.validation,
        fc.is_income
      FROM "GE65TB7856036050100002_TBC_GEL" t
      LEFT JOIN financial_codes fc ON t.financial_code_uuid = fc.uuid
      WHERE t.payment_id = $1
    `, paymentId);
    
    console.log(JSON.stringify(tx, null, 2));
  }
  
  await prisma.$disconnect();
}

check().catch(console.error);
