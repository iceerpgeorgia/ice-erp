const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const txUuids = [
    '3a12ae80-e254-5dcb-ab78-bae37c26664b',
    '3377c242-fde4-5813-87ef-42fe2bcf7e6a',
    '0921d89a-cc26-51b6-8c5e-8fe2751b34ed'
  ];
  
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  console.log('=== CHECKING TRANSACTION DETAILS ===\n');
  
  for (const uuid of txUuids) {
    const tx = await prisma.$queryRawUnsafe(`
      SELECT 
        uuid,
        raw_record_uuid,
        payment_id,
        project_uuid,
        financial_code_uuid,
        nominal_amount,
        transaction_date,
        account_currency_amount
      FROM "GE65TB7856036050100002_TBC_GEL"
      WHERE uuid = $1::uuid
    `, uuid);
    
    if (tx.length > 0) {
      const t = tx[0];
      console.log(`UUID: ${t.uuid}`);
      console.log(`  Payment ID: ${t.payment_id}`);
      console.log(`  Project UUID: ${t.project_uuid}`);
      console.log(`  Financial Code UUID: ${t.financial_code_uuid}`);
      console.log(`  Amount: ${t.nominal_amount} on ${t.transaction_date}`);
      console.log(`  Account Currency Amount: ${t.account_currency_amount}\n`);
    }
  }
  
  // Now check if these are being filtered out by the API
  console.log('\n=== CHECKING API FILTER LOGIC ===\n');
  console.log(`The API query filters: WHERE project_uuid = '${projectUuid}'::uuid`);
  console.log('\nFor each transaction:\n');
  
  for (const uuid of txUuids) {
    const tx = await prisma.$queryRawUnsafe(`
      SELECT payment_id, project_uuid, financial_code_uuid
      FROM "GE65TB7856036050100002_TBC_GEL"
      WHERE uuid = $1::uuid
    `, uuid);
    
    if (tx.length > 0) {
      const t = tx[0];
      const wouldBeIncluded = t.project_uuid === projectUuid ? '✓ WOULD BE INCLUDED' : `✗ FILTERED OUT (project_uuid=${t.project_uuid})`;
      console.log(`${t.payment_id}: ${wouldBeIncluded}`);
    }
  }
  
  await prisma.$disconnect();
}

check().catch(console.error);
