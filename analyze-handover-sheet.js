const JSZip = require('jszip');
const fs = require('fs');

(async () => {
  console.log('=== HANDOVER SHEET ANALYSIS ===');
  console.log('');

  const filePath = 'd:/export-test-3.xlsx';
  const fileBuffer = fs.readFileSync(filePath);
  const zip = new JSZip();
  await zip.loadAsync(fileBuffer);

  const sheet1Xml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');

  if (!sheet1Xml) {
    console.log('❌ sheet1.xml NOT FOUND');
    return;
  }

  console.log('Checking Handover sheet (sheet1.xml):');
  console.log('');

  // Look at row 4 which should have formulas
  const row4Pattern = /<row r="4"[\s\S]*?<\/row>/;
  const row4Match = sheet1Xml.match(row4Pattern);

  if (row4Match) {
    const row4 = row4Match[0];
    console.log('Row 4 XML (first 2000 chars):');
    console.log(row4.substring(0, 2000));
    console.log('');
    
    // Look for formulas with f tag
    const formulaMatches = row4.match(/<f>[^<]*<\/f>/g);
    if (formulaMatches) {
      console.log('Formulas in row 4:');
      formulaMatches.slice(0, 3).forEach(f => {
        const content = f.replace(/<\/?f>/g, '');
        console.log('  ' + content.substring(0, 80));
      });
    }
  }

  console.log('');
  console.log('Checking for cached values (v tags):');
  
  // Check if there are any v tags in row 4-6
  const row4to6 = sheet1Xml.match(/<row r="[456]"[\s\S]*?<\/row>/g);
  if (row4to6) {
    const vMatches = row4to6.join('').match(/<v>[^<]*<\/v>/g);
    console.log('Value cells found: ' + (vMatches ? vMatches.length : 0));
    if (vMatches) {
      console.log('First few values:');
      vMatches.slice(0, 10).forEach(v => {
        const val = v.replace(/<\/?v>/g, '');
        console.log('  ' + val);
      });
    }
  }

  console.log('');
  console.log('Checking for #REF! or error cells:');
  const errorMatches = sheet1Xml.match(/<v>#[A-Z!]*<\/v>/g);
  if (errorMatches && errorMatches.length > 0) {
    console.log('❌ ERROR CELLS FOUND:');
    errorMatches.slice(0, 10).forEach(e => {
      console.log('  ' + e);
    });
  } else {
    console.log('No error cells found');
  }
})();
