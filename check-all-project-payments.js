const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllPayments() {
  try {
    const projectUuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f';
    
    // Get ALL payments for this project
    const allPayments = await prisma.$queryRawUnsafe(`
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
      ORDER BY created_at, id
    `, projectUuid);

    console.log('\n=== ALL Payments for Project ===');
    console.log('Total:', allPayments.length);

    // Group by composite unique key to find actual duplicates
    const grouped = allPayments.reduce((acc, p) => {
      const key = `${p.financial_code_uuid}|${p.counteragent_uuid || 'null'}|${p.job_uuid || 'null'}|${p.income_tax}|${p.currency_uuid || 'null'}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});

    console.log('\n=== Checking for Duplicates (by composite unique key) ===');
    const duplicates = [];
    let duplicateGroups = 0;

    Object.entries(grouped).forEach(([key, payments]) => {
      if (payments.length > 1) {
        duplicateGroups++;
        console.log(`\n❌ DUPLICATE GROUP ${duplicateGroups}:`);
        console.log(`Key: ${key}`);
        console.log(`Count: ${payments.length}`);
        payments.forEach((p, i) => {
          console.log(`\n  ${i + 1}. ID: ${p.id} ${i === 0 ? '✅ (KEEP - oldest)' : '❌ (DELETE)'}`);
          console.log(`     payment_id: ${p.payment_id || '(empty)'}`);
          console.log(`     is_project_derived: ${p.is_project_derived}`);
          console.log(`     is_bundle_payment: ${p.is_bundle_payment}`);
          console.log(`     created_at: ${p.created_at}`);
        });
        // Keep the oldest (first), delete the rest
        duplicates.push(...payments.slice(1).map(p => p.id));
      }
    });

    if (duplicates.length > 0) {
      console.log('\n\n=== SUMMARY ===');
      console.log(`Found ${duplicateGroups} duplicate groups`);
      console.log(`Total payments to DELETE: ${duplicates.length}`);
      console.log('\nIDs to delete:', duplicates.map(id => id.toString()).join(', '));
    } else {
      console.log('\n✅ No duplicates found!');
    }

    // Show breakdown by type
    console.log('\n=== Breakdown by Type ===');
    const breakdown = {
      bundle: allPayments.filter(p => p.is_bundle_payment).length,
      projectDerived: allPayments.filter(p => p.is_project_derived && !p.is_bundle_payment).length,
      manual: allPayments.filter(p => !p.is_project_derived).length
    };
    console.log(`Bundle payments: ${breakdown.bundle}`);
    console.log(`Project-derived (non-bundle): ${breakdown.projectDerived}`);
    console.log(`Manual payments: ${breakdown.manual}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllPayments();
