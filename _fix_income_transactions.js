const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTransactions() {
  console.log('=== FIXING INCOME TRANSACTIONS WITH NULL PROJECT_UUID ===\n');
  
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  // Map: payment_id -> financial_code_uuid
  const fixes = {
    '744590_16_a6d0c4': '34087c63-d9c7-4cc2-9c37-33de11dd1355',  // 1.1.1.3. ლიფტების საბაჟოზე შემოსვლის ავანსი
    '500f5c_cb_4201d1': 'ed8ce82e-1955-4328-810f-6000af09348d',  // 1.1.1.2. ლიფტების საქარხნო მზაობის ავანსი
    '9b906c_11_539eba': 'd65fc9fe-504b-4e0e-9b3f-bbd2575974d1'   // 1.1.1.1. ლიფტების ავანსი
  };
  
  for (const [paymentId, fcUuid] of Object.entries(fixes)) {
    console.log(`Fixing ${paymentId}...`);
    
    const result = await prisma.$queryRawUnsafe(`
      UPDATE "GE65TB7856036050100002_TBC_GEL"
      SET project_uuid = $1::uuid,
          financial_code_uuid = $2::uuid
      WHERE payment_id = $3
        AND project_uuid IS NULL
      RETURNING uuid, payment_id, project_uuid, financial_code_uuid
    `, projectUuid, fcUuid, paymentId);
    
    if (result.length > 0) {
      result.forEach(r => {
        console.log(`  ✓ Updated transaction ${r.uuid}`);
        console.log(`    - Project UUID: ${r.project_uuid}`);
        console.log(`    - Financial Code UUID: ${r.financial_code_uuid}`);
      });
    } else {
      console.log(`  ⚠ No transactions found with this payment_id and NULL project_uuid`);
    }
    console.log();
  }
  
  // Verify the fix
  console.log('\n=== VERIFICATION ===\n');
  const txUuids = [
    '3a12ae80-e254-5dcb-ab78-bae37c26664b',
    '3377c242-fde4-5813-87ef-42fe2bcf7e6a',
    '0921d89a-cc26-51b6-8c5e-8fe2751b34ed'
  ];
  
  for (const uuid of txUuids) {
    const tx = await prisma.$queryRawUnsafe(`
      SELECT uuid, payment_id, project_uuid, financial_code_uuid, nominal_amount
      FROM "GE65TB7856036050100002_TBC_GEL"
      WHERE uuid = $1::uuid
    `, uuid);
    
    if (tx.length > 0) {
      const t = tx[0];
      const status = (t.project_uuid === projectUuid) ? '✓' : '✗';
      console.log(`${status} ${t.payment_id}`);
      console.log(`  Project UUID: ${t.project_uuid}`);
      console.log(`  Financial Code UUID: ${t.financial_code_uuid}\n`);
    }
  }
  
  console.log('\n=== RESULT ===');
  console.log('Income transactions are now visible in /api/bank-transactions?project_uuid=...');
  console.log('and will appear on the Handovers page filtered by income payment IDs.');
  
  await prisma.$disconnect();
}

fixTransactions().catch(console.error);
