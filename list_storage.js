#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get the currently active template
  const template = await prisma.templates.findFirst({
    where: { operation_type: 'handover', is_active: true },
  });

  if (!template) {
    console.log('No active template found');
    process.exit(1);
  }

  console.log('Current template in DB:');
  console.log(`  file_name: ${template.file_name}`);
  console.log(`  storage_path: ${template.storage_path}`);

  // List files in templates bucket to see what's really there
  console.log('\nListing files in templates/handover/:');
  const { data: files, error } = await supabase.storage.from('templates').list('handover', { limit: 100 });
  
  if (error) {
    console.log('Error listing:', error.message);
  } else if (!files || files.length === 0) {
    console.log('  (no files found)');
  } else {
    files.forEach(f => {
      console.log(`  - ${f.name}`);
    });
  }

  process.exit(0);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
