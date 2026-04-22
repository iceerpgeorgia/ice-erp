require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAll() {
  try {
    const projectUuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f';
    
    const allPayments = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id, 
        p.payment_id, 
        fc.code as fc_code,
        fc.name as fc_name,
        p.is_project_derived, 
        p.is_bundle_payment, 
        p.created_at,
        (SELECT COUNT(*) FROM payments_ledger WHERE payment_id = p.payment_id) as ledger_count
      FROM payments p
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      WHERE p.project_uuid = $1::uuid
      ORDER BY fc.code, p.created_at
    `, projectUuid);
    
    console.log('\n=== All Payments for Test Project ===');
    console.log(`Total: ${allPayments.length}\n`);
    
    // Group by FC code
    const byFC = {};
    allPayments.forEach(p => {
      if (!byFC[p.fc_code]) byFC[p.fc_code] = [];
      byFC[p.fc_code].push(p);
    });
    
    Object.entries(byFC).forEach(([fcCode, payments]) => {
      console.log(`\n${fcCode} - ${payments[0].fc_name}`);
      console.log(`  Count: ${payments.length} payment(s)`);
      
      payments.forEach((p, i) => {
        console.log(`  ${i+1}. ID: ${p.id}, payment_id: ${p.payment_id || '(empty)'}`);
        console.log(`     is_project_derived: ${p.is_project_derived}, is_bundle_payment: ${p.is_bundle_payment}`);
        console.log(`     ledger_count: ${p.ledger_count}, created: ${p.created_at}`);
      });
      
      if (payments.length > 1) {
        console.log(`  ⚠️  DUPLICATE!`);
      }
    });
    
    const duplicateFCs = Object.entries(byFC).filter(([_, payments]) => payments.length > 1);
    console.log(`\n\n=== Summary ===`);
    console.log(`Total FCs: ${Object.keys(byFC).length}`);
    console.log(`FCs with duplicates: ${duplicateFCs.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAll();
