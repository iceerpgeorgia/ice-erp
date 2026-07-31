const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking and fixing storage paths in database...\n');
    
    // Get all handover templates
    const templates = await prisma.templates.findMany({
      where: { operation_type: 'handover' }
    });

    console.log('Current templates:');
    for (const template of templates) {
      console.log(`  ${template.is_active ? '✓' : '○'} ${template.file_name}`);
      console.log(`    Current path: ${template.storage_path}`);
      
      // Fix if it has duplicated bucket name
      if (template.storage_path.includes('templates/templates/')) {
        const correctedPath = template.storage_path.replace('templates/templates/', 'templates/');
        console.log(`    Fixed path:   ${correctedPath}`);
        
        await prisma.templates.update({
          where: { uuid: template.uuid },
          data: { storage_path: correctedPath }
        });
        
        console.log('    ✓ Updated');
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
