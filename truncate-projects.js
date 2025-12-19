const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function truncate() {
  try {
    // Delete employees first (foreign key constraint)
    const empResult = await prisma.projectEmployee.deleteMany();
    console.log(`✓ Deleted ${empResult.count} project employee assignments`);
    
    const result = await prisma.project.deleteMany();
    console.log(`✓ Deleted ${result.count} projects from local database`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

truncate();
