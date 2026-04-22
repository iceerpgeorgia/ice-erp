const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBundleData() {
  const projectUuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f';
  
  console.log('\n=== PROJECT INFO ===');
  const project = await prisma.$queryRawUnsafe(
    `SELECT project_uuid::text, project_name, financial_code_uuid::text, value 
     FROM projects 
     WHERE project_uuid = $1::uuid`,
    projectUuid
  );
  console.log(project[0]);
  
  console.log('\n=== BUNDLE PAYMENTS ===');
  const payments = await prisma.$queryRawUnsafe(
    `SELECT payment_id, financial_code_uuid::text, is_bundle_payment, is_project_derived
     FROM payments 
     WHERE project_uuid = $1::uuid AND is_bundle_payment = true
     ORDER BY payment_id`,
    projectUuid
  );
  console.log(`Found ${payments.length} bundle payments:`);
  payments.forEach(p => console.log(p));
  
  console.log('\n=== PAYMENTS_LEDGER DATA ===');
  for (const p of payments) {
    const ledger = await prisma.$queryRawUnsafe(
      `SELECT payment_id, effective_date, accrual, "order", comment
       FROM payments_ledger 
       WHERE payment_id = $1`,
      p.payment_id
    );
    console.log(`\nPayment ${p.payment_id}:`);
    ledger.forEach(l => console.log(l));
    if (ledger.length === 0) console.log('  (no ledger entries)');
  }
  
  console.log('\n=== CHILD FINANCIAL CODES ===');
  if (project[0]) {
    const childFCs = await prisma.$queryRawUnsafe(
      `SELECT uuid::text, code, name, is_active
       FROM financial_codes 
       WHERE parent_uuid = $1::uuid
       ORDER BY sort_order, code`,
      project[0].financial_code_uuid
    );
    console.log(`Found ${childFCs.length} child financial codes:`);
    childFCs.forEach(fc => console.log(fc));
  }
  
  await prisma.$disconnect();
}

checkBundleData().catch(console.error);
