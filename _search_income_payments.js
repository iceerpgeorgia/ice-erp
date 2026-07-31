const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  // The income payment IDs
  const incomePaymentIds = [
    '1d7aa5_2a_69fe3f',
    '500f5c_cb_4201d1', 
    '67f67f_7b_bc2325',
    '744590_16_a6d0c4',
    '7bdc0e_2c_24f1a0',
    '9b906c_11_539eba'
  ];
  
  console.log('=== SEARCHING FOR INCOME PAYMENT TRANSACTIONS ===\n');
  
  const tables = [
    'GE78BG0000000893486000_BOG_GEL',
    'GE65TB7856036050100002_TBC_GEL',
  ];
  
  for (const paymentId of incomePaymentIds) {
    console.log(`\nSearching for payment: ${paymentId}`);
    let found = false;
    
    for (const table of tables) {
      const tx = await prisma.$queryRawUnsafe(
        `SELECT payment_id, nominal_amount, transaction_date FROM "${table}" WHERE payment_id = $1 LIMIT 1`,
        paymentId
      );
      
      if (tx.length > 0) {
        console.log(`  ✓ Found in ${table}`);
        found = true;
      }
    }
    
    if (!found) {
      console.log(`  ✗ NOT FOUND in any bank transaction table`);
    }
  }
  
  // Also check what payment_ids ARE in the TBC_GEL table
  console.log('\n\n=== PAYMENT IDs ACTUALLY IN GE65TB7856036050100002_TBC_GEL ===');
  const paymentIds = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT payment_id, fc.is_income, fc.validation
    FROM "GE65TB7856036050100002_TBC_GEL" t
    LEFT JOIN financial_codes fc ON t.financial_code_uuid = fc.uuid
    WHERE t.project_uuid = $1::uuid
    ORDER BY payment_id
  `, projectUuid);
  
  console.log(JSON.stringify(paymentIds, null, 2));
  
  await prisma.$disconnect();
}

check().catch(console.error);
