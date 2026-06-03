const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const types = await prisma.document_types.findMany({
    where: {
      name: {
        contains: 'ექსპლუატაციაში'
      }
    }
  });
  types.forEach(t => {
    console.log(`UUID: ${t.uuid}, Name: ${t.name}, ID: ${t.id}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
