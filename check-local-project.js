const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const result = await prisma.$queryRaw`
    SELECT project_name, counteragent, project_index 
    FROM projects 
    WHERE project_uuid = '26a47fbe-6b71-4d89-b27b-4629deea1d34'
  `;
  
  console.log('✅ Local DB verification:');
  console.log('  Name:', result[0].project_name);
  console.log('  Counteragent:', result[0].counteragent);
  console.log('  Index:', result[0].project_index);
  
  await prisma.$disconnect();
}

check();
