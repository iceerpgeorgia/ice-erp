const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.$queryRaw`SELECT COUNT(*) FROM consolidated_bank_accounts`;
  const withAccount = await prisma.$queryRaw`SELECT COUNT(*) FROM consolidated_bank_accounts WHERE counteragent_account_number IS NOT NULL`;
  
  const totalCount = Number(total[0].count);
  const withAccountCount = Number(withAccount[0].count);
  
  console.log('='.repeat(60));
  console.log('COUNTERAGENT ACCOUNT STATISTICS');
  console.log('='.repeat(60));
  console.log(`Total records: ${totalCount.toLocaleString()}`);
  console.log(`Records with CA Account: ${withAccountCount.toLocaleString()}`);
  console.log(`Records without CA Account: ${(totalCount - withAccountCount).toLocaleString()}`);
  console.log(`Percentage filled: ${((withAccountCount/totalCount)*100).toFixed(2)}%`);
  console.log('='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
