const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTemplate() {
  console.log('Checking active handover template...');
  
  const active = await prisma.templates.findFirst({
    where: {
      operation_type: 'handover',
      is_active: true,
    },
  });
  
  if (active) {
    console.log('\n✓ Active template found:');
    console.log('  UUID:', active.uuid);
    console.log('  File:', active.file_name);
    console.log('  Storage path:', active.storage_path);
    console.log('  Size:', active.file_size_bytes, 'bytes');
    console.log('\nDeactivating to force use of cleaned file system version...');
    
    const updated = await prisma.templates.update({
      where: { uuid: active.uuid },
      data: { is_active: false },
    });
    
    console.log('✓ Template deactivated - export will now use cleaned file system template');
  } else {
    console.log('No active template found - export should already use file system fallback');
  }
  
  await prisma.$disconnect();
  process.exit(0);
}

checkTemplate().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
