#!/usr/bin/env node
const https = require('https');
const { URL } = require('url');

const urls = [
  'https://fojbzghphznbslqwurrm.supabase.co/storage/v1/object/public/handover/1782312368013-Handover Tamplate New.xlsx',
  'https://fojbzghphznbslqwurrm.supabase.co/storage/v1/object/public/handover/1782312368013-Handover%20Tamplate%20New.xlsx',
  'https://fojbzghphznbslqwurrm.supabase.co/storage/v1/object/public/templates/handover/1782312368013-Handover%20Tamplate%20New.xlsx',
];

let completed = 0;

urls.forEach((url, idx) => {
  console.log(`\n[${idx+1}] Testing: ${url}`);
  
  try {
    const urlObj = new URL(url);
    https.get(urlObj, (res) => {
      console.log(`    Status: ${res.statusCode}`);
      if (res.statusCode !== 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            console.log(`    Error: ${json.error}`);
          } catch (e) {
            console.log(`    Response: ${data.substring(0, 100)}`);
          }
          completed++;
          if (completed === urls.length) process.exit(0);
        });
      } else {
        console.log(`    ✓ SUCCESS! (${res.headers['content-length']} bytes)`);
        completed++;
        if (completed === urls.length) process.exit(0);
      }
    }).on('error', (e) => {
      console.log(`    Error: ${e.message}`);
      completed++;
      if (completed === urls.length) process.exit(1);
    });
  } catch (e) {
    console.log(`    Parse error: ${e.message}`);
    completed++;
    if (completed === urls.length) process.exit(1);
  }
});
