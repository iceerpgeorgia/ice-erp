const fetch = require('node-fetch');

async function testAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/bank-transactions');
    const data = await response.json();
    
    console.log('\n=== API Response Sample ===\n');
    console.log(`Total records: ${data.length}`);
    
    const withCA = data.filter(r => r.counteragent_account_number);
    console.log(`Records with CA Account: ${withCA.length}`);
    
    console.log('\n=== First 3 records with CA Account ===\n');
    withCA.slice(0, 3).forEach((r, i) => {
      console.log(`${i + 1}. UUID: ${r.uuid}`);
      console.log(`   CA Account: ${r.counteragent_account_number}`);
      console.log(`   Description: ${r.description?.substring(0, 50)}...`);
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();
