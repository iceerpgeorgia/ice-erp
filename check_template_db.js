#!/usr/bin/env node
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const template = await prisma.templates.findFirst({
    where: {
      operation_type: 'handover',
      is_active: true,
    },
  });

  if (!template) {
    console.log('NO ACTIVE TEMPLATE FOUND!');
    process.exit(1);
  }

  console.log('Active handover template:');
  console.log(`  file_name: ${template.file_name}`);
  console.log(`  storage_path: ${template.storage_path}`);
  console.log(`  storage_provider: ${template.storage_provider}`);
  console.log(`  file_size_bytes: ${template.file_size_bytes}`);
  console.log(`  created_at: ${template.created_at}`);
  console.log(`\nFull URL would be: ${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${template.storage_path}`);

  process.exit(0);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
