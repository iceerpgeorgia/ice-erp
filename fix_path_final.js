#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  const correctedPath = 'templates/handover/1782312368013-Handover Tamplate New.xlsx';
  
  console.log('Updating template storage_path to correct value...');
  
  const template = await prisma.templates.findFirst({
    where: { operation_type: 'handover', is_active: true },
  });

  if (!template) {
    console.log('ERROR: No active template found!');
    process.exit(1);
  }

  console.log(`  Old: ${template.storage_path}`);
  console.log(`  New: ${correctedPath}`);
  
  const updated = await prisma.templates.update({
    where: { uuid: template.uuid },
    data: { storage_path: correctedPath },
  });

  console.log('\n✓ Updated!');
  console.log(`  storage_path: ${updated.storage_path}`);
  
  // Verify URL
  const correctUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${correctedPath}`;
  console.log(`\n  URL: ${correctUrl}`);
  console.log(`  URL encoded: ${correctUrl.replace(/ /g, '%20')}`);

  process.exit(0);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
