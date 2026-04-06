const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyBucket() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Found' : 'Missing');
    console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Found' : 'Missing');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Checking Supabase Storage bucket: payment-attachments\n');

  try {
    // List all buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      process.exit(1);
    }

    console.log('📦 All buckets in your Supabase project:');
    buckets.forEach(bucket => {
      const isTarget = bucket.id === 'payment-attachments' || bucket.name === 'payment-attachments';
      console.log(`   ${isTarget ? '✅' : '  '} ${bucket.id} (${bucket.name}) - Public: ${bucket.public}`);
    });
    console.log('');

    // Check if payment-attachments exists
    const paymentBucket = buckets.find(b => b.id === 'payment-attachments' || b.name === 'payment-attachments');
    
    if (!paymentBucket) {
      console.error('❌ Bucket "payment-attachments" NOT FOUND');
      console.error('   Please create it in Supabase Dashboard:');
      console.error('   Storage → New bucket → Name: payment-attachments, Public: OFF');
      process.exit(1);
    }

    console.log('✅ Bucket "payment-attachments" exists!');
    console.log(`   ID: ${paymentBucket.id}`);
    console.log(`   Name: ${paymentBucket.name}`);
    console.log(`   Public: ${paymentBucket.public}`);
    console.log(`   Created: ${paymentBucket.created_at}`);
    console.log('');

    // Test creating a signed upload URL
    console.log('🔑 Testing signed upload URL generation...');
    const testPath = 'test/verification-test.txt';
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-attachments')
      .createSignedUploadUrl(testPath);

    if (uploadError) {
      console.error('❌ Error creating signed upload URL:', uploadError.message);
      console.error('   This might indicate missing storage policies.');
      console.error('   Run this SQL in your Supabase SQL Editor:');
      console.error('');
      console.error('   CREATE POLICY "Allow authenticated upload"');
      console.error('   ON storage.objects FOR INSERT TO authenticated');
      console.error('   WITH CHECK (bucket_id = \'payment-attachments\');');
      console.error('');
      console.error('   CREATE POLICY "Allow authenticated download"');
      console.error('   ON storage.objects FOR SELECT TO authenticated');
      console.error('   USING (bucket_id = \'payment-attachments\');');
      console.error('');
      console.error('   CREATE POLICY "Allow authenticated delete"');
      console.error('   ON storage.objects FOR DELETE TO authenticated');
      console.error('   USING (bucket_id = \'payment-attachments\');');
      process.exit(1);
    }

    console.log('✅ Signed upload URL generated successfully!');
    console.log(`   URL: ${uploadData.signedUrl.substring(0, 80)}...`);
    console.log(`   Token: ${uploadData.token.substring(0, 40)}...`);
    console.log('');

    // Test listing files (should work even if empty)
    console.log('📂 Testing file listing...');
    const { data: files, error: listFilesError } = await supabase.storage
      .from('payment-attachments')
      .list('', { limit: 10 });

    if (listFilesError) {
      console.error('❌ Error listing files:', listFilesError.message);
      console.error('   Storage policies might be missing or incorrect.');
      process.exit(1);
    }

    console.log(`✅ File listing works! (${files.length} files found)`);
    console.log('');
    
    console.log('🎉 All checks passed! The bucket is properly configured.');
    console.log('   You can now upload attachments from the Payments Report page.');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

verifyBucket();
