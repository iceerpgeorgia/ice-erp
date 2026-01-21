const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.consolidatedBankAccount.count()
  .then(count => {
    console.log(`\nTotal records in Supabase: ${count.toLocaleString()}\n`);
  })
  .finally(() => prisma.$disconnect());
