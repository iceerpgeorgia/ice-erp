const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('=== CHECKING IF NULL-PROJECT TRANSACTIONS ARE FILTERED OUT ===\n');
  
  // Query what the API would return for the project
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  const result = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as total, 
           SUM(CASE WHEN project_uuid IS NULL THEN 1 ELSE 0 END) as null_project_count,
           SUM(CASE WHEN project_uuid = $1::uuid THEN 1 ELSE 0 END) as matching_project_count
    FROM "GE65TB7856036050100002_TBC_GEL"
  `, projectUuid);
  
  console.log('TBC_GEL Table Counts:');
  console.log(`  Total: ${result[0].total}`);
  console.log(`  NULL project_uuid: ${result[0].null_project_count}`);
  console.log(`  Matching project_uuid: ${result[0].matching_project_count}`);
  
  // Show the null-project transactions
  console.log('\n=== NULL PROJECT TRANSACTIONS IN TBC_GEL ===');
  const nullTx = await prisma.$queryRawUnsafe(`
    SELECT payment_id, nominal_amount, transaction_date, project_uuid, financial_code_uuid
    FROM "GE65TB7856036050100002_TBC_GEL"
    WHERE project_uuid IS NULL
    ORDER BY transaction_date
  `);
  
  console.log(`Found ${nullTx.length} transactions with NULL project_uuid:`);
  for (const tx of nullTx) {
    console.log(`  ${tx.payment_id}: ${tx.nominal_amount} on ${tx.transaction_date}`);
  }
  
  // Match them to payments to confirm they're income
  console.log('\n=== CONFIRMING THESE ARE INCOME PAYMENTS ===');
  for (const tx of nullTx) {
    const p = await prisma.payments.findFirst({
      where: { payment_id: tx.payment_id },
      select: { 
        payment_id: true,
        project_uuid: true,
        financial_code_uuid: true,
        financial_codes: { select: { validation: true, is_income: true } }
      }
    });
    
    console.log(`Payment ${tx.payment_id}:`);
    console.log(`  Project in payments table: ${p?.project_uuid}`);
    console.log(`  Financial Code (payment): ${p?.financial_codes?.validation}`);
    console.log(`  Is Income: ${p?.financial_codes?.is_income}`);
  }
  
  await prisma.$disconnect();
}

check().catch(console.error);
