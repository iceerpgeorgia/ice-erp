const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function uploadTemplateToSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Step 1: Create templates bucket if it doesn't exist
    console.log('Checking if templates bucket exists...');
    
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    const templatesExist = buckets?.some(b => b.name === 'templates');
    
    if (!templatesExist) {
      console.log('Templates bucket does not exist. Creating it...');
      
      const { data, error } = await supabase.storage.createBucket('templates', {
        public: true,
      });

      if (error) {
        console.error('Error creating bucket:', error);
        return;
      }
      
      console.log('✓ Templates bucket created');
    } else {
      console.log('✓ Templates bucket already exists');
    }

    // Step 2: Upload template file
    console.log('\nUploading template file to Supabase...');
    
    const templatePath = path.join(process.cwd(), 'public', 'Handover Tamplate New.xlsx');
    const fileBuffer = fs.readFileSync(templatePath);
    const storagePath = 'templates/handover/1782299709398-Handover Tamplate New.xlsx';

    const { data, error: uploadError } = await supabase.storage
      .from('templates')
      .upload(storagePath, fileBuffer, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading template:', uploadError);
      return;
    }

    console.log('✓ Template file uploaded successfully');
    console.log('  Path:', storagePath);
    console.log('  Size:', fileBuffer.length, 'bytes');
    
    // Step 3: Verify upload
    console.log('\nVerifying upload...');
    
    const { data: file, error: getError } = await supabase.storage
      .from('templates')
      .getPublicUrl(storagePath);

    if (getError) {
      console.error('Error getting public URL:', getError);
      return;
    }

    console.log('✓ Public URL:', file.publicUrl);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

uploadTemplateToSupabase();
