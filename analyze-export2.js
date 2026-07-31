const JSZip = require('jszip');
const fs = require('fs');

(async () => {
  console.log('=== PLACEHOLDERS SHEET ANALYSIS - EXPORT 2 ===');
  console.log('');

  const filePath = 'd:/export-test-2.xlsx';
  const fileBuffer = fs.readFileSync(filePath);
  const zip = new JSZip();
  await zip.loadAsync(fileBuffer);

  const sheet2Xml = await zip.file('xl/worksheets/sheet2.xml')?.async('string');

  if (!sheet2Xml) {
    console.log('❌ sheet2.xml NOT FOUND');
    return;
  }

  // Extract all rows with data
  const rowPattern = /<row r="(\d+)"[^>]*>[\s\S]*?<\/row>/g;
  const rows = [];
  let match;
  
  while ((match = rowPattern.exec(sheet2Xml)) !== null) {
    const rowNum = match[1];
    const rowContent = match[0];
    
    // Extract cells
    const cellPattern = /<c r="([A-Z]+\d+)"[^>]*>[\s\S]*?<\/c>/g;
    let cellMatch;
    
    while ((cellMatch = cellPattern.exec(rowContent)) !== null) {
      const cellRef = cellMatch[1];
      const fullCell = cellMatch[0];
      
      // Extract value (either <v> for numbers or <is><t> for text)
      const vMatch = fullCell.match(/<v>([^<]*)<\/v>/);
      const isMatch = fullCell.match(/<is><t>([^<]*)<\/t><\/is>/);
      const value = vMatch ? vMatch[1] : (isMatch ? isMatch[1] : '(empty)');
      
      rows.push({ cellRef, value });
    }
  }

  console.log('Placeholders data (cell reference => value):');
  console.log('');
  
  rows.forEach(r => {
    const displayValue = r.value === '' ? '(EMPTY STRING)' : r.value;
    console.log(r.cellRef + ': ' + displayValue.substring(0, 60));
  });
  
  console.log('');
  console.log('Count: ' + rows.length + ' cells populated');
  
  const emptyCount = rows.filter(r => r.value === '' || r.value === '(empty)').length;
  console.log('Empty cells: ' + emptyCount);
})();
