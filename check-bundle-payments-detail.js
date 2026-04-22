const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBundlePayments() {
  try {
    const projectUuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f';
    
    // Get all bundle payments for this project
    const bundlePayments = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id,
        p.payment_id,
        p.financial_code_uuid,
        p.is_project_derived,
        p.is_bundle_payment,
        p.created_at,
        fc.code as fc_code,
        fc.name as fc_name,
        (SELECT COUNT(*) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as ledger_count,
        (SELECT SUM(accrual) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id AND is_deleted = false) as total_accrual,
        (SELECT SUM("order") FROM payments_ledger pl WHERE pl.payment_id = p.payment_id AND is_deleted = false) as total_order
      FROM payments p
      LEFT JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
      WHERE p.project_uuid = $1::uuid 
        AND p.is_project_derived = true 
        AND p.is_bundle_payment = true
      ORDER BY p.created_at, p.id
    `, projectUuid);

    console.log('\n=== Bundle Payments Details ===');
    console.log('Total:', bundlePayments.length);
    
    bundlePayments.forEach((p, i) => {
      console.log(`\n${i + 1}. ID: ${p.id}`);
      console.log(`   FC: ${p.fc_code} - ${p.fc_name}`);
      console.log(`   payment_id: ${p.payment_id || '(empty)'}`);
      console.log(`   created_at: ${p.created_at}`);
      console.log(`   ledger_count: ${p.ledger_count}`);
      console.log(`   total_accrual: ${p.total_accrual || 0}`);
      console.log(`   total_order: ${p.total_order || 0}`);
    });

    // Check for duplicates by FC
    const grouped = bundlePayments.reduce((acc, p) => {
      const key = p.financial_code_uuid;
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});

    console.log('\n=== Duplicate Check ===');
    const duplicates = [];
    Object.entries(grouped).forEach(([fcUuid, payments]) => {
      if (payments.length > 1) {
        console.log(`\n❌ DUPLICATE: ${payments[0].fc_code} - ${payments[0].fc_name}`);
        console.log(`   Count: ${payments.length}`);
        payments.forEach((p, i) => {
          console.log(`   ${i + 1}. ID ${p.id} - created ${p.created_at} - payment_id: ${p.payment_id || '(empty)'} ${i === 0 ? '(KEEP)' : '(DELETE)'}`);
        });
        duplicates.push(...payments.slice(1).map(p => p.id));
      }
    });

    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} duplicates to delete`);
      console.log('IDs:', duplicates.join(', '));
    } else {
      console.log('\n✅ No duplicates found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBundlePayments();
