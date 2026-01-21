const { PrismaClient } = require('@prisma/client');

// Enable query logging
const prisma = new PrismaClient({
  log: ['query'],
});

async function checkConnection() {
  console.log("\n=== Prisma Connection Check ===\n");
  
  // Execute a simple query
  const count = await prisma.consolidatedBankAccount.count();
  console.log(`\nTotal count returned: ${count.toLocaleString()}\n`);
  
  // Check database connection
  const result = await prisma.$queryRaw`SELECT current_database(), current_schema()`;
  console.log("Database:", result[0].current_database);
  console.log("Schema:", result[0].current_schema);
  
  await prisma.$disconnect();
}

checkConnection();
