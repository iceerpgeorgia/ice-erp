const fetch = require('node-fetch');

async function testAttachmentsAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/attachments?page=1&limit=50');
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAttachmentsAPI();
