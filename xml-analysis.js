const JSZip = require('jszip');
const fs = require('fs');

(async () => {
  console.log('=== RAW XML ANALYSIS OF EXPORTED FILE ===');
  console.log('');

  const filePath = 'd:/export-test.xlsx';
  const fileBuffer = fs.readFileSync(filePath);
  const zip = new JSZip();
  await zip.loadAsync(fileBuffer);

  const sheet2Xml = await zip.file('xl/worksheets/sheet2.xml')?.async('string');

  if (!sheet2Xml) {
    console.log('❌ sheet2.xml NOT FOUND');
    return;
  }

  // Find row 1
  const row1Match = sheet2Xml.match(/<row r="1"[^>]*>[\s\S]*?<\/row>/);
  
  if (row1Match) {
    console.log('Row 1 XML:');
    const row1 = row1Match[0];
    
    // Pretty print it
    const prettified = row1
      .replace(/></g, '>\n<')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .join('\n');
    
    console.log(prettified.substring(0, 500));
    console.log('');
  }

  // Count total cells in placeholders sheet
  const cellMatches = sheet2Xml.match(/<c r="[^"]*"/g);
  console.log('Total cells in Placeholders sheet: ' + (cellMatches ? cellMatches.length : 0));
  console.log('');

  // Check for A column cells specifically
  const aColumnCells = sheet2Xml.match(/<c r="A\d+"[^>]*>/g);
  console.log('Column A cells found: ' + (aColumnCells ? aColumnCells.length : 0));
  
  if (aColumnCells) {
    console.log('Column A cell refs:');
    aColumnCells.forEach(c => {
      const match = c.match(/r="([^"]*)"/);
      if (match) console.log('  ' + match[1]);
    });
  }
})();
