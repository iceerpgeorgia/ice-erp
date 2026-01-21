const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get sample records
  const samples = await prisma.salary_accruals.findMany({
    take: 5,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      payment_id: true,
      counteragent_uuid: true,
      salary_month: true,
    },
  });

  console.log('\n✅ Sample Updated Payment IDs:');
  samples.forEach((s) => {
    console.log(`  ID ${s.id}: ${s.payment_id}`);
  });

  // Count total
  const total = await prisma.salary_accruals.count();
  console.log(`\n📊 Total salary accruals: ${total}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
