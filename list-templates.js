const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function listTemplates() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Listing files in templates bucket...\n');
    
    const { data, error } = await supabase.storage
      .from('templates')
      .list();

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('Files in root:');
    data?.forEach(file => {
      console.log(`  ${file.name}${file.metadata ? ' (file)' : ' (folder)'}`);
    });

    // List handover subfolder
    console.log('\nFiles in handover subfolder:');
    const { data: handoverFiles, error: handoverError } = await supabase.storage
      .from('templates')
      .list('handover');

    if (handoverError) {
      console.error('Error listing handover:', handoverError);
      return;
    }

    handoverFiles?.forEach(file => {
      console.log(`  ${file.name}`);
    });

    // List templates/handover subfolder (might be nested)
    console.log('\nFiles in templates/handover subfolder:');
    const { data: nestedFiles, error: nestedError } = await supabase.storage
      .from('templates')
      .list('templates/handover');

    if (nestedError) {
      console.log('  (not found or error)');
    } else {
      nestedFiles?.forEach(file => {
        console.log(`  ${file.name}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

listTemplates();
