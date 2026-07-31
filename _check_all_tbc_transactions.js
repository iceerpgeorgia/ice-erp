const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  // Check ALL transactions on TBC_GEL with their financial codes
  console.log('\n=== ALL TRANSACTIONS ON GE65TB7856036050100002_TBC_GEL ===');
  const allTbcTx = await prisma.$queryRawUnsafe(`
    SELECT 
      t.uuid,
      t.payment_id,
      t.financial_code_uuid,
      t.nominal_amount,
      t.account_currency_amount,
      t.transaction_date,
      fc.validation as financial_code,
      fc.is_income
    FROM "GE65TB7856036050100002_TBC_GEL" t
    LEFT JOIN financial_codes fc ON t.financial_code_uuid = fc.uuid
    WHERE t.project_uuid = $1::uuid
    ORDER BY t.transaction_date DESC
  `, projectUuid);
  
  console.log(JSON.stringify(allTbcTx, null, 2));
  
  // Check if there are transactions with NO payment_id but with income financial codes
  console.log('\n=== LOOKING FOR UNLINKED INCOME TRANSACTIONS ===');
  const unlinked = await prisma.$queryRawUnsafe(`
    SELECT 
      t.uuid,
      t.payment_id,
      t.financial_code_uuid,
      t.nominal_amount,
      fc.validation as financial_code,
      fc.is_income
    FROM "GE65TB7856036050100002_TBC_GEL" t
    LEFT JOIN financial_codes fc ON t.financial_code_uuid = fc.uuid
    WHERE t.project_uuid = $1::uuid
      AND (t.payment_id IS NULL OR t.payment_id = '')
      AND fc.is_income = true
  `, projectUuid);
  
  console.log('Unlinked income transactions:', JSON.stringify(unlinked, null, 2));
  
  // Check if the income payments have any associated transactions at all
  console.log('\n=== INCOME PAYMENTS (searching for transactions) ===');
  const incomePaymentIds = [
    '1d7aa5_2a_69fe3f',
    '500f5c_cb_4201d1',
    '67f67f_7b_bc2325',
    '744590_16_a6d0c4',
    '7bdc0e_2c_24f1a0',
    '9b906c_11_539eba'
  ];
  
  for (const paymentId of incomePaymentIds) {
    // Search in all tables
    const tables = [
      'GE78BG0000000893486000_BOG_GEL',
      'GE65TB7856036050100002_TBC_GEL',
    ];
    
    for (const table of tables) {
      const txCount = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM "${table}" WHERE payment_id = $1 AND project_uuid = $2::uuid`,
        paymentId,
        projectUuid
      );
      
      if (txCount[0].cnt > 0) {
        console.log(`✓ ${paymentId} found in ${table}: ${txCount[0].cnt} transaction(s)`);
      }
    }
  }
  
  await prisma.$disconnect();
}

check().catch(console.error);
