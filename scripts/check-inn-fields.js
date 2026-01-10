const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkInnFields() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        dockey,
        entriesid,
        docsenderinn,
        docbenefinn,
        docpayerinn,
        docsendername,
        docbenefname,
        docpayername,
        docnomination
      FROM bog_gel_raw_893486000
      ORDER BY docvaluedate DESC
      LIMIT 50
    `);

    console.log('\n=== LATEST 50 RECORDS - INN FIELDS ===\n');
    
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.dockey}_${row.entriesid}`);
      console.log(`   sender_inn:     [${row.docsenderinn || ''}] - ${row.docsendername || ''}`);
      console.log(`   benef_inn:      [${row.docbenefinn || ''}] - ${row.docbenefname || ''}`);
      console.log(`   payer_inn:      [${row.docpayerinn || ''}] - ${row.docpayername || ''}`);
      console.log(`   description:    ${row.docnomination ? row.docnomination.substring(0, 80) : ''}`);
      console.log('');
    });

    // Summary
    const withSenderInn = result.rows.filter(r => r.docsenderinn && r.docsenderinn.trim()).length;
    const withBenefInn = result.rows.filter(r => r.docbenefinn && r.docbenefinn.trim()).length;
    const withPayerInn = result.rows.filter(r => r.docpayerinn && r.docpayerinn.trim()).length;

    console.log('\n=== SUMMARY ===');
    console.log(`Records with docsenderinn:     ${withSenderInn}/50`);
    console.log(`Records with docbenefinn:      ${withBenefInn}/50`);
    console.log(`Records with docpayerinn:      ${withPayerInn}/50`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkInnFields();
