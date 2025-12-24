const { Client } = require('pg');

async function showPaymentIds() {
  const client = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });

  try {
    await client.connect();
    console.log('Connected to database\n');
    
    const result = await client.query(`
      SELECT 
        payment_id,
        record_uuid,
        created_at
      FROM payments 
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (result.rows.length === 0) {
      console.log('No payments found in the database yet.');
    } else {
      console.log('📊 Payment IDs (newest first):\n');
      result.rows.forEach((row, i) => {
        console.log(`${i + 1}. Payment ID:  ${row.payment_id}`);
        console.log(`   Record UUID:  ${row.record_uuid}`);
        console.log(`   Created:      ${new Date(row.created_at).toLocaleString()}`);
        console.log('');
      });
    }
    
    console.log('\n📋 Payment ID Format (same as record_uuid):');
    console.log('   Format: 6hex_2hex_4hex');
    console.log('   Example: a3f5c9_4b_12d8');
    console.log('');
    console.log('   Where:');
    console.log('   - 6 random hex characters (0-9, a-f)');
    console.log('   - underscore separator');
    console.log('   - 2 random hex characters');
    console.log('   - underscore separator');
    console.log('   - 4 random hex characters');
    console.log('');
    console.log('   Both payment_id and record_uuid are unique identifiers');
    console.log('   generated using the same random format.');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    process.exit(0);
  }
}

showPaymentIds();
