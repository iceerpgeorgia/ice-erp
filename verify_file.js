#!/usr/bin/env node
const https = require('https');
const { URL } = require('url');

const url = 'https://fojbzghphznbslqwurrm.supabase.co/storage/v1/object/public/handover/1782312368013-Handover Tamplate New.xlsx';
console.log(`Checking: ${url}\n`);

const urlObj = new URL(url);
https.get(urlObj, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Content-Type: ${res.headers['content-type']}`);
  console.log(`Content-Length: ${res.headers['content-length']} bytes`);
  
  if (res.statusCode === 200) {
    console.log('\n✓ File found in Supabase!');
  } else {
    console.log('\n✗ File NOT found or error');
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Response:', data.substring(0, 200));
    });
  }
  process.exit(res.statusCode === 200 ? 0 : 1);
}).on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
