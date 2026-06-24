#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const filePath = path.join(process.cwd(), 'public', 'Handover Tamplate New.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  console.log('Uploading template to Supabase...');
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = '1782312368013-Handover Tamplate New.xlsx';
  const storagePath = `handover/${fileName}`;

  console.log(`  Local file: ${filePath}`);
  console.log(`  File size: ${fileBuffer.length} bytes`);
  console.log(`  Target path: ${storagePath}`);

  const { data, error } = await supabase.storage
    .from('templates')
    .upload(storagePath, fileBuffer, {
      cacheControl: '3600',
      upsert: true, // Overwrite if exists
    });

  if (error) {
    console.error('✗ Upload failed:', error.message);
    process.exit(1);
  }

  console.log('✓ Upload successful!');
  console.log(`  Path: ${data.path}`);
  console.log(`  Full URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${data.path}`);

  process.exit(0);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
