#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  // Update the template to have the correct storage path
  const correctedPath = 'handover/1782312368013-Handover Tamplate New.xlsx';
  
  console.log('Updating template storage_path...');
  console.log(`  Old: templates/templates/handover/1782312368013-Handover Tamplate New.xlsx`);
  console.log(`  New: ${correctedPath}`);
  
  const updated = await prisma.templates.update({
    where: {
      uuid: (await prisma.templates.findFirst({
        where: { operation_type: 'handover', is_active: true },
      })).uuid,
    },
    data: {
      storage_path: correctedPath,
    },
  });

  console.log('\n✓ Template updated!');
  console.log(`  UUID: ${updated.uuid}`);
  console.log(`  storage_path: ${updated.storage_path}`);
  
  // Verify the correct URL now
  const correctUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${correctedPath}`;
  console.log(`\nCorrect public URL: ${correctUrl}`);

  process.exit(0);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
