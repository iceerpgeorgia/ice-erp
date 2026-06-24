const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Fetching active handover template...\n');
    
    const activeTemplate = await prisma.templates.findFirst({
      where: {
        operation_type: 'handover',
        is_active: true,
      },
    });

    if (activeTemplate) {
      console.log('✓ Active template found:');
      console.log('  - File name:', activeTemplate.file_name);
      console.log('  - Storage provider:', activeTemplate.storage_provider);
      console.log('  - Storage bucket:', activeTemplate.storage_bucket);
      console.log('  - Storage path:', activeTemplate.storage_path);
      console.log('  - File size:', activeTemplate.file_size_bytes, 'bytes');
      console.log('  - Created at:', activeTemplate.created_at);
      console.log('  - Created by:', activeTemplate.created_by_user_id);
    } else {
      console.log('✗ No active handover template found in database!');
    }

    console.log('\nAll handover templates (including inactive):\n');
    const allTemplates = await prisma.templates.findMany({
      where: {
        operation_type: 'handover',
      },
    });

    allTemplates.forEach(t => {
      console.log(`  ${t.is_active ? '✓ ACTIVE' : '○ INACTIVE'}: ${t.file_name}`);
      console.log(`    UUID: ${t.uuid}`);
      console.log(`    Path: ${t.storage_path}`);
      console.log(`    Size: ${t.file_size_bytes} bytes`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
