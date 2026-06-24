#!/usr/bin/env node
require('dotenv').config();
const https = require('https');
const { URL } = require('url');

const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/templates/templates/handover/1782312368013-Handover Tamplate New.xlsx`;
console.log(`Fetching: ${url}`);

const urlObj = new URL(url);

https.get(urlObj, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Content-Type: ${res.headers['content-type']}`);
  console.log(`Content-Length: ${res.headers['content-length']}`);
  
  if (res.statusCode !== 200) {
    console.log('ERROR: File not found or not accessible');
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Response body:', data.substring(0, 200));
      process.exit(1);
    });
    return;
  }

  let buffer = Buffer.alloc(0);
  res.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
  });

  res.on('end', () => {
    console.log(`Received ${buffer.length} bytes`);
    
    // Try to read as ZIP
    try {
      const JSZip = require('jszip');
      const zip = new JSZip();
      zip.loadAsync(buffer).then(z => {
        const files = z.file(/.+\.xml$/).filter(f => f.name.includes('sheet'));
        console.log('\nSheet files in Supabase template:');
        files.forEach(f => {
          console.log(`  - ${f.name}`);
        });
        process.exit(0);
      }).catch(e => {
        console.error('Error loading ZIP:', e.message);
        process.exit(1);
      });
    } catch (e) {
      console.error('Error:', e.message);
      process.exit(1);
    }
  });
}).on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});
