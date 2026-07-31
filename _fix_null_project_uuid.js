const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTransactions() {
  console.log('=== FIXING NULL PROJECT_UUID TRANSACTIONS ===\n');
  
  // Map of payment_id -> (project_uuid, financial_code_uuid)
  const incomePayments = {
    '1d7aa5_2a_69fe3f': { project: 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1', fc: 'b0a03047-b57b-4d4d-81d5-985f66832458' },
    '500f5c_cb_4201d1': { project: 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1', fc: 'ed8ce82e-1955-4328-810f-6000af09348d' },
    '67f67f_7b_bc2325': { project: 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1', fc: '34a7e31c-b651-479a-bb44-9c043172abfa' },
    '744590_16_a6d0c4': { project: 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1', fc: '34087c63-d9c7-4cc2-9c37-33de11dd1355' },
    '7bdc0e_2c_24f1a0': { project: 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1', fc: 'ec639125-e73f-4116-b664-0706cc47cffa' },
    '9b906c_11_539eba': { project: 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1', fc: 'd65fc9fe-504b-4e0e-9b3f-bbd2575974d1' }
  };
  
  // Fix each transaction
  for (const [paymentId, data] of Object.entries(incomePayments)) {
    console.log(`\nUpdating ${paymentId}...`);
    
    // Update in TBC_GEL table
    const result = await prisma.$queryRawUnsafe(`
      UPDATE "GE65TB7856036050100002_TBC_GEL"
      SET project_uuid = $1::uuid,
          financial_code_uuid = $2::uuid
      WHERE payment_id = $3
        AND project_uuid IS NULL
      RETURNING uuid, payment_id, project_uuid
    `, data.project, data.fc, paymentId);
    
    if (result.length > 0) {
      console.log(`  ✓ Updated ${result.length} row(s) in TBC_GEL`);
    } else {
      console.log(`  - No matching rows found in TBC_GEL with NULL project`);
    }
  }
  
  // Verify the fix
  console.log('\n=== VERIFICATION ===\n');
  const checkPaymentIds = ['500f5c_cb_4201d1', '744590_16_a6d0c4', '9b906c_11_539eba'];
  for (const pid of checkPaymentIds) {
    const tx = await prisma.$queryRawUnsafe(`
      SELECT payment_id, project_uuid, financial_code_uuid, nominal_amount
      FROM "GE65TB7856036050100002_TBC_GEL"
      WHERE payment_id = $1
    `, pid);
    
    if (tx.length > 0) {
      const t = tx[0];
      console.log(`${pid}:`);
      console.log(`  Project UUID: ${t.project_uuid}`);
      console.log(`  Financial Code UUID: ${t.financial_code_uuid}`);
      console.log(`  Amount: ${t.nominal_amount}\n`);
    }
  }
  
  await prisma.$disconnect();
}

fixTransactions().catch(console.error);
