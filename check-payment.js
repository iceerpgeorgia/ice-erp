const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PAYMENT_ID = 'edef76_79_bc6056';

(async () => {
  try {
    console.log(`Checking payment: ${PAYMENT_ID}\n`);
    
    // Find the payment with related financial code
    const payment = await prisma.$queryRawUnsafe(`
      SELECT 
        p.record_uuid,
        p.payment_id,
        p.counteragent_uuid,
        p.project_uuid,
        p.financial_code_uuid,
        p.income_tax,
        p.is_project_derived,
        p.is_bundle_payment,
        p.waybill_derived,
        fc.code,
        fc.is_income
      FROM payments p
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      WHERE p.payment_id = $1
    `, PAYMENT_ID);
    
    if (payment && payment.length > 0) {
      const p = payment[0];
      console.log('✓ Payment found:');
      console.log(`  Record UUID: ${p.record_uuid}`);
      console.log(`  Payment ID: ${p.payment_id}`);
      console.log(`  Project UUID: ${p.project_uuid || '(NULL)'}`);
      console.log(`  Counteragent UUID: ${p.counteragent_uuid || '(NULL)'}`);
      console.log(`  Financial Code: ${p.code || '(NULL)'}`);
      console.log(`  Financial Code UUID: ${p.financial_code_uuid || '(NULL)'}`);
      console.log(`  Is Income: ${p.is_income}`);
      console.log(`  Is Project Derived: ${p.is_project_derived}`);
    } else {
      console.log('✗ Payment NOT found in payments table');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await prisma.$disconnect();
})();
