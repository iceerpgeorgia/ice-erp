const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listBrands() {
  const brands = await prisma.$queryRaw`
    SELECT uuid, name FROM brands ORDER BY name
  `;
  
  console.log(`\nTotal: ${brands.length} brands\n`);
  brands.forEach((b, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${b.name}`);
  });
  
  await prisma.$disconnect();
}

listBrands();
