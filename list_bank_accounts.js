const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.bankAccount.findMany({
    select: {
      uuid: true,
      accountNumber: true,
      rawTableName: true,
    },
  });

  console.log('\n📋 Bank Accounts:');
  accounts.forEach((a) => {
    console.log(`  ${a.accountNumber} - UUID: ${a.uuid} - Table: ${a.rawTableName || 'N/A'}`);
  });
  console.log(`\nTotal: ${accounts.length} accounts\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
