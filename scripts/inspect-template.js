#!/usr/bin/env node
/**
 * Diagnostic script to inspect handover template structure
 * Shows actual XML for placeholder cells
 */
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

async function inspectTemplate() {
  try {
    const templatePath = path.join(__dirname, '../public/handover template.xlsx');
    
    if (!fs.existsSync(templatePath)) {
      console.error('❌ Template file not found at:', templatePath);
      process.exit(1);
    }

    const templateBuffer = fs.readFileSync(templatePath);
    const zip = new JSZip();
    await zip.loadAsync(templateBuffer);

    const sheet2Xml = await zip.file('xl/worksheets/sheet2.xml')?.async('string');
    if (!sheet2Xml) {
      console.error('❌ sheet2.xml not found in template');
      process.exit(1);
    }

    console.log('\n=== SHEET2.XML INSPECTION ===\n');
    console.log('Total size:', sheet2Xml.length, 'bytes\n');

    // Show first 3000 chars to understand structure
    console.log('First 3000 chars of XML:');
    console.log(sheet2Xml.substring(0, 3000));
    console.log('\n...\n');

    console.log('\n=== EXPECTED PLACEHOLDER CELLS ===');
    console.log('Should find/populate: B1, B2, B3, B4, B5, B6, B7, B8, B9, B10, B11, B12, B13, B14, B15, B16, B17, B18, B19');
    console.log('\n=== REGEX TEST ===');
    
    // Test the patterns used in the actual code
    const testCells = ['B1', 'B2', 'B5', 'B9', 'B16', 'B18'];
    for (const testCell of testCells) {
      const pattern1 = new RegExp(`(<c r="${testCell}"[^>]*>.*?)<v>[^<]*</v>(.*?</c>)`, 's');
      const pattern2 = new RegExp(`<c r="${testCell}"([^>]*)/>`, 's');
      
      const found1 = pattern1.test(sheet2Xml);
      const found2 = pattern2.test(sheet2Xml);
      
      console.log(`${testCell}: pattern1=${found1}, pattern2=${found2}`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectTemplate();
