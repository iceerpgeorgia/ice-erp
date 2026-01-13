const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw`
    SELECT uuid, counteragent_account_number, description 
    FROM consolidated_bank_accounts 
    WHERE counteragent_account_number IS NOT NULL 
    LIMIT 10
  `;
  
  console.log('\n=== Sample records with CA Account ===\n');
  rows.forEach(r => {
    console.log(`UUID: ${r.uuid}`);
    console.log(`CA Account: ${r.counteragent_account_number}`);
    console.log(`Description: ${r.description}`);
    console.log('---');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
