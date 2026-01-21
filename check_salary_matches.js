const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check salary payment IDs in consolidated table
  const salaryInConsolidated = await prisma.$queryRawUnsafe(`
    SELECT payment_id, COUNT(*) as count
    FROM consolidated_bank_accounts
    WHERE payment_id LIKE 'NP_%_NJ_%_PRL%'
    GROUP BY payment_id
    ORDER BY payment_id
    LIMIT 10
  `);

  console.log('\n📊 Salary Payment IDs in Consolidated Table:');
  console.log(`Total unique salary payment IDs: ${salaryInConsolidated.length}`);
  if (salaryInConsolidated.length > 0) {
    console.log('\nSample IDs:');
    salaryInConsolidated.forEach((row) => {
      console.log(`  ${row.payment_id} (${row.count} records)`);
    });
  } else {
    console.log('⚠️  NO SALARY PAYMENT IDs FOUND!\n');
  }

  // Check a few salary_accruals payment IDs
  const salaryAccruals = await prisma.salary_accruals.findMany({
    take: 5,
    select: { payment_id: true },
    orderBy: { id: 'asc' },
  });

  console.log('\n📋 Sample Payment IDs from salary_accruals:');
  salaryAccruals.forEach((s) => console.log(`  ${s.payment_id}`));

  // Try case-insensitive match
  if (salaryAccruals.length > 0) {
    const firstId = salaryAccruals[0].payment_id;
    const upperMatch = await prisma.$queryRawUnsafe(`
      SELECT payment_id 
      FROM consolidated_bank_accounts 
      WHERE UPPER(payment_id) = UPPER('${firstId}')
      LIMIT 1
    `);
    
    console.log(`\n🔍 Case-insensitive test for "${firstId}":`);
    if (upperMatch.length > 0) {
      console.log(`  ✅ FOUND (case-insensitive): ${upperMatch[0].payment_id}`);
      if (upperMatch[0].payment_id !== firstId) {
        console.log(`  ⚠️  CASE MISMATCH DETECTED!`);
        console.log(`     Expected: ${firstId}`);
        console.log(`     Found:    ${upperMatch[0].payment_id}`);
      }
    } else {
      console.log(`  ❌ NOT FOUND even with case-insensitive match`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
