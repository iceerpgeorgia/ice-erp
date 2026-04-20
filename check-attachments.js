const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAttachments() {
  try {
    const total = await prisma.attachments.count();
    const active = await prisma.attachments.count({ where: { is_active: true } });
    const inactive = await prisma.attachments.count({ where: { is_active: false } });
    
    console.log(`Total attachments: ${total}`);
    console.log(`Active (is_active=true): ${active}`);
    console.log(`Inactive (is_active=false): ${inactive}`);
    
    if (total > 0) {
      console.log('\n--- Sample attachments ---');
      const samples = await prisma.attachments.findMany({
        take: 5,
        select: {
          id: true,
          uuid: true,
          file_name: true,
          is_active: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' }
      });
      console.table(samples);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAttachments();
