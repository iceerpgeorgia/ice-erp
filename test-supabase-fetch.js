require('dotenv').config();

async function testSupabaseFetch() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const storagePath = 'templates/handover/1782299709398-Handover Tamplate New.xlsx';

    console.log('Supabase URL:', supabaseUrl);
    console.log('Storage path:', storagePath);
    console.log('Service key exists:', !!supabaseKey);

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials!');
      return;
    }

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/templates/templates/handover/1782299709398-Handover Tamplate New.xlsx`;
    console.log('\nFetching from (public):', fileUrl);

    const fetchRes = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    console.log('Status:', fetchRes.status, fetchRes.statusText);
    console.log('Content-Type:', fetchRes.headers.get('content-type'));
    console.log('Content-Length:', fetchRes.headers.get('content-length'));

    if (fetchRes.ok) {
      const buffer = Buffer.from(await fetchRes.arrayBuffer());
      console.log('✓ Successfully fetched template, size:', buffer.length, 'bytes');
    } else {
      const text = await fetchRes.text();
      console.error('✗ Fetch failed! Response:', text.substring(0, 200));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSupabaseFetch();
