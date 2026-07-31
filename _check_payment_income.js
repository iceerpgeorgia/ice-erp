const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  // Get the payment details from the TBC transaction
  const payment = await prisma.payments.findFirst({
    where: { payment_id: '8cba49_b7_db24e8' },
    select: {
      payment_id: true,
      financial_code_uuid: true,
      project_uuid: true,
      counteragent_uuid: true,
      is_active: true,
    }
  });
  
  console.log('\n=== PAYMENT RECORD ===');
  console.log(JSON.stringify(payment, null, 2));
  
  if (payment?.financial_code_uuid) {
    const fc = await prisma.financial_codes.findUnique({
      where: { uuid: payment.financial_code_uuid },
      select: { validation: true, is_income: true }
    });
    console.log('\n=== PAYMENT FINANCIAL CODE ===');
    console.log(JSON.stringify(fc, null, 2));
  }
  
  // Check payments_report API response
  console.log('\n=== CHECKING PAYMENTS_REPORT ===');
  const payments = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT
      p.payment_id,
      p.financial_code_uuid,
      fc.validation,
      fc.is_income,
      p.project_uuid
    FROM payments p
    LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
    WHERE p.project_uuid = $1::uuid
      AND p.is_active = true
    ORDER BY p.payment_id
  `, projectUuid);
  
  console.log('\n=== ALL ACTIVE PAYMENTS FOR PROJECT ===');
  console.log(JSON.stringify(payments, null, 2));
  
  await prisma.$disconnect();
}

check().catch(console.error);
