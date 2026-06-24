const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function listBuckets() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Listing all storage buckets...\n');
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('Available buckets:');
    data?.forEach(bucket => {
      console.log(`  - ${bucket.name} (public: ${bucket.public})`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listBuckets();
