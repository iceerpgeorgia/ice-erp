const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check what payment_ids exist
  const allPaymentIds = await prisma.$queryRawUnsafe(`
    SELECT payment_id, COUNT(*) as count
    FROM consolidated_bank_accounts
    WHERE payment_id IS NOT NULL
    GROUP BY payment_id
    ORDER BY count DESC
    LIMIT 20
  `);

  console.log('\n📊 Top Payment IDs in Consolidated Table:');
  allPaymentIds.forEach((row) => {
    console.log(`  "${row.payment_id}" (${row.count} records)`);
  });

  // Check if salary pattern exists (case-insensitive)
  const salaryPattern = await prisma.$queryRawUnsafe(`
    SELECT payment_id
    FROM consolidated_bank_accounts
    WHERE payment_id ~* 'NP_[a-f0-9]{6}_NJ_[a-f0-9]{6}_PRL[0-9]{6}'
    LIMIT 10
  `);

  console.log(`\n🔍 Salary Pattern Matches (case-insensitive regex): ${salaryPattern.length}`);
  if (salaryPattern.length > 0) {
    salaryPattern.forEach((row) => console.log(`  ${row.payment_id}`));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
