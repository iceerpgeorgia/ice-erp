const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function find() {
  const docs = await prisma.document_types.findMany({
    where: {
      name: {
        contains: 'შემოწმების',
        mode: 'insensitive'
      }
    },
    select: { uuid: true, name: true }
  });
  
  console.log('Found document types with შემოწმების:');
  for (const d of docs) {
    console.log(`  ${d.uuid}: ${d.name}`);
  }
  
  const cert = await prisma.document_types.findMany({
    where: {
      name: {
        contains: 'ექსპლუატაციაში',
        mode: 'insensitive'
      }
    },
    select: { uuid: true, name: true }
  });
  
  console.log('\nFound document types with ექსპლუატაციაში:');
  for (const d of cert) {
    console.log(`  ${d.uuid}: ${d.name}`);
  }
  
  await prisma.$disconnect();
}

find().catch(console.error);
