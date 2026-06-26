import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTemplate() {
  const active = await prisma.templates.findFirst({
    where: {
      operation_type: 'handover',
      is_active: true,
    },
  });
  
  if (active) {
    console.log('Active template found:');
    console.log('  UUID:', active.uuid);
    console.log('  File:', active.file_name);
    console.log('  Storage path:', active.storage_path);
    console.log('  Size:', active.file_size_bytes, 'bytes');
    console.log('\nDeactivating this template to force use of cleaned file system version...');
    
    const updated = await prisma.templates.update({
      where: { uuid: active.uuid },
      data: { is_active: false },
    });
    
    console.log('✓ Template deactivated');
  } else {
    console.log('No active template found');
  }
  
  await prisma.$disconnect();
}

checkTemplate().catch(e => {
  console.error(e);
  process.exit(1);
});
