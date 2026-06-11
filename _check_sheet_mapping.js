const XLSX = require('xlsx');
const fs = require('fs');
const JSZip = require('jszip');

// Method 1: Using XLSX to read sheets
console.log('=== XLSX Method ===');
const file = XLSX.readFile('public/handover template.xlsx');
console.log('Sheets (in order):', file.SheetNames);

// Method 2: Using JSZip to check workbook.xml relationships
console.log('\n=== JSZip Method (workbook.xml) ===');
const buffer = fs.readFileSync('public/handover template.xlsx');
JSZip.loadAsync(buffer).then(async (zip) => {
  const wbContent = await zip.file('xl/workbook.xml').async('string');
  
  // Find sheet elements
  const sheetMatches = wbContent.match(/<sheet[^>]*>/g) || [];
  console.log('Sheets in workbook.xml:');
  sheetMatches.forEach((match, idx) => {
    const nameMatch = match.match(/name="([^"]*)"/);
    const sheetIdMatch = match.match(/sheetId="([^"]*)"/);
    const ridMatch = match.match(/r:id="([^"]*)"/);
    console.log(`  ${idx + 1}. ${nameMatch?.[1] || 'UNKNOWN'} (id=${sheetIdMatch?.[1] || '?'}, rid=${ridMatch?.[1] || '?'})`);
  });
  
  // Check rels file to map relationship IDs to XML files
  console.log('\n=== Relationship mappings (workbook.xml.rels) ===');
  const relsContent = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const relMatches = relsContent.match(/<Relationship[^>]*>/g) || [];
  relMatches.forEach((match) => {
    const idMatch = match.match(/Id="([^"]*)"/);
    const typeMatch = match.match(/Type="[^"]*worksheet"/);
    const targetMatch = match.match(/Target="([^"]*)"/);
    if (typeMatch && idMatch) {
      console.log(`  ${idMatch[1]} -> ${targetMatch?.[1] || '?'}`);
    }
  });
}).catch(err => console.error('Error:', err));
