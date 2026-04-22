// Delete duplicate bundle payments (newer ones with no ledger entries)
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteDuplicates() {
  try {
    console.log('\n=== Deleting Duplicate Bundle Payments ===\n');
    
    const duplicatesToDelete = [7290, 7287, 7288, 7289];
    
    // First, show what we're deleting
    const toDelete = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id,
        p.payment_id,
        fc.code as fc_code,
        fc.name as fc_name,
        p.created_at,
        (SELECT COUNT(*) FROM payments_ledger WHERE payment_id = p.payment_id) as ledger_count
      FROM payments p
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      WHERE p.id = ANY($1::bigint[])
      ORDER BY p.id
    `, duplicatesToDelete);
    
    console.log('Payments to be deleted:');
    for (const payment of toDelete) {
      console.log(`  ID: ${payment.id} - ${payment.fc_code} - ${payment.payment_id}`);
      console.log(`    Ledger entries: ${payment.ledger_count}`);
      console.log(`    Created: ${payment.created_at}\n`);
      
      if (payment.ledger_count > 0) {
        console.log(`    ⚠️  WARNING: This payment has ${payment.ledger_count} ledger entries!`);
        console.log(`    Are you sure you want to delete it? This might cause data loss.\n`);
      }
    }
    
    // Delete them
    const result = await prisma.$queryRawUnsafe(
      `DELETE FROM payments WHERE id = ANY($1::bigint[])`,
      duplicatesToDelete
    );
    
    console.log(`\n✅ Deleted ${duplicatesToDelete.length} duplicate payments.\n`);
    
    // Verify no more duplicates
    const remaining = await prisma.$queryRawUnsafe(`
      SELECT 
        financial_code_uuid,
        COUNT(*) as count
      FROM payments
      WHERE project_uuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f'::uuid
        AND is_bundle_payment = true
      GROUP BY financial_code_uuid
      HAVING COUNT(*) > 1
    `);
    
    if (remaining.length === 0) {
      console.log('✅ No bundle payment duplicates remaining for test project.');
    } else {
      console.log(`⚠️  Still have ${remaining.length} FCs with duplicates:`);
      console.log(remaining);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteDuplicates();
