const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Updating storage paths to match actual Supabase location...\n');
    
    // The files are actually at templates/templates/handover/...
    // Update database to match
    const updated = await prisma.templates.updateMany({
      where: {
        operation_type: 'handover',
        storage_path: { contains: 'templates/handover/' }
      },
      data: {
        storage_path: 'templates/templates/handover/1782299709398-Handover Tamplate New.xlsx'
      }
    });

    console.log(`Updated ${updated.count} templates\n`);

    // Verify
    const templates = await prisma.templates.findMany({
      where: { operation_type: 'handover' }
    });

    console.log('Updated templates:');
    templates.forEach(t => {
      console.log(`  ${t.is_active ? '✓ ACTIVE' : '○ INACTIVE'}: ${t.file_name}`);
      console.log(`    Storage path: ${t.storage_path}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
