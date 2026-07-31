const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  console.log('=== CHECKING TBC_GEL FOR PROJECT abe14ec6-0eeb-4c77-beeb-fd0186a562f1 ===\n');
  
  // Get transactions with NULL project
  const nullTx = await prisma.$queryRawUnsafe(`
    SELECT payment_id, nominal_amount, transaction_date
    FROM "GE65TB7856036050100002_TBC_GEL"
    WHERE project_uuid IS NULL
  `);
  
  // Filter to just the income ones we know about
  const incomePaymentIds = ['500f5c_cb_4201d1', '744590_16_a6d0c4', '9b906c_11_539eba'];
  const nullIncomeProjects = nullTx.filter(tx => incomePaymentIds.includes(tx.payment_id));
  
  console.log(`Transactions in GE65TB7856036050100002_TBC_GEL with project_uuid = NULL:\n`);
  for (const tx of nullIncomeProjects) {
    console.log(`✓ ${tx.payment_id}: ${tx.nominal_amount} on ${tx.transaction_date}`);
  }
  
  console.log(`\nTotal transactions with NULL project: ${nullTx.length}`);
  console.log(`Income transactions with NULL project: ${nullIncomeProjects.length}`);
  
  // Confirm these payments are in the payments table for this project
  console.log(`\n=== THESE PAYMENTS EXIST IN PAYMENTS TABLE FOR THIS PROJECT ===\n`);
  for (const pid of incomePaymentIds) {
    const p = await prisma.payments.findFirst({
      where: { payment_id: pid, project_uuid: projectUuid },
      select: { financial_codes: { select: { validation: true, is_income: true } } }
    });
    
    if (p) {
      console.log(`✓ ${pid}`);
      console.log(`  - Income: ${p.financial_codes?.is_income}`);
      console.log(`  - Code: ${p.financial_codes?.validation}\n`);
    }
  }
  
  console.log('\n=== ROOT CAUSE ===');
  console.log('These income transactions exist in GE65TB7856036050100002_TBC_GEL table');
  console.log('but they have project_uuid = NULL');
  console.log('Therefore, when /api/bank-transactions filters by project_uuid,');
  console.log('these transactions are excluded (WHERE project_uuid = ...) ');
  console.log('\nThe handovers page then filters for income payment IDs,');
  console.log('but since the bank transactions are already filtered out, they never appear.');
  
  await prisma.$disconnect();
}

check().catch(console.error);
