const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    const projectUuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f';
    
    // Get all bundle payments for this project
    const bundlePayments = await prisma.$queryRawUnsafe(`
      SELECT 
        id, 
        payment_id, 
        financial_code_uuid, 
        counteragent_uuid,
        job_uuid,
        income_tax,
        currency_uuid,
        is_project_derived, 
        is_bundle_payment, 
        created_at,
        updated_at
      FROM payments 
      WHERE project_uuid = $1::uuid 
        AND is_project_derived = true 
        AND is_bundle_payment = true
      ORDER BY financial_code_uuid, created_at
    `, projectUuid);

    console.log('\n=== Bundle Payments for Project ===');
    console.log('Total:', bundlePayments.length);
    console.log('\nDetails:');
    bundlePayments.forEach((p, i) => {
      console.log(`\n${i + 1}. ID: ${p.id}`);
      console.log(`   payment_id: ${p.payment_id || '(empty)'}`);
      console.log(`   financial_code_uuid: ${p.financial_code_uuid}`);
      console.log(`   created_at: ${p.created_at}`);
      console.log(`   updated_at: ${p.updated_at}`);
    });

    // Group by financial_code_uuid to find duplicates
    const grouped = bundlePayments.reduce((acc, p) => {
      const key = p.financial_code_uuid;
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});

    console.log('\n=== Duplicates by Financial Code ===');
    const duplicates = [];
    Object.entries(grouped).forEach(([fcUuid, payments]) => {
      if (payments.length > 1) {
        console.log(`\nFinancial Code: ${fcUuid}`);
        console.log(`  Count: ${payments.length} (DUPLICATE!)`);
        payments.forEach((p, i) => {
          console.log(`  ${i + 1}. ID ${p.id} - created ${p.created_at} ${i === 0 ? '(KEEP)' : '(DELETE)'}`);
        });
        // Mark newer ones for deletion (keep the oldest)
        duplicates.push(...payments.slice(1).map(p => p.id));
      }
    });

    if (duplicates.length > 0) {
      console.log('\n=== IDs to DELETE ===');
      console.log(duplicates.map(id => id.toString()).join(', '));
      console.log(`\nTotal payments to delete: ${duplicates.length}`);
    } else {
      console.log('\n✅ No duplicates found!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
