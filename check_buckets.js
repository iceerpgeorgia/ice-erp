#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log('Listing all buckets...\n');
  
  const { data: buckets, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  if (!buckets || buckets.length === 0) {
    console.log('No buckets found!');
    process.exit(0);
  }

  buckets.forEach(bucket => {
    console.log(`- ${bucket.name}`);
    console.log(`  ID: ${bucket.id}`);
    console.log(`  Public: ${bucket.public}`);
    console.log(`  Created: ${bucket.created_at}`);
  });

  // Check templates bucket specifically
  console.log('\n---\nChecking templates bucket specifically:');
  const { data: files, error: listError } = await supabase.storage
    .from('templates')
    .list('handover', { limit: 10 });

  if (listError) {
    console.log('Error listing templates/handover:', listError.message);
  } else {
    console.log('Files in handover folder:');
    if (files && files.length > 0) {
      files.forEach(f => console.log(`  - ${f.name}`));
    } else {
      console.log('  (empty)');
    }
  }

  process.exit(0);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
