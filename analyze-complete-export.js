const JSZip = require('jszip');
const XLSX = require('xlsx');
const fs = require('fs');

(async () => {
  console.log('=== COMPLETE PROJECT EXPORT ANALYSIS ===');
  console.log('');

  const filePath = 'd:/export-complete.xlsx';
  const fileBuffer = fs.readFileSync(filePath);
  
  // Parse with XLSX
  const workbook = XLSX.read(fileBuffer);
  const handoverSheet = workbook.Sheets['Handover'];
  
  console.log('Handover Sheet Analysis:');
  
  // Check for content
  if (!handoverSheet['!ref']) {
    console.log('❌ Handover sheet is EMPTY');
  } else {
    const range = XLSX.utils.decode_range(handoverSheet['!ref']);
    console.log('Range: ' + handoverSheet['!ref']);
    console.log('');
    
    // Check row 4-6 which should have data
    console.log('Sample cells (should show actual values):');
    const testCells = ['C4', 'C6', 'I4', 'I5', 'I6'];
    testCells.forEach(cellRef => {
      const cell = handoverSheet[cellRef];
      if (cell) {
        const val = cell.v || cell.f || '(empty)';
        const typeMarker = cell.f ? '[FORMULA]' : '[VALUE]';
        console.log('  ' + cellRef + ' ' + typeMarker + ': ' + JSON.stringify(val).substring(0, 60));
      } else {
        console.log('  ' + cellRef + ': (no cell)');
      }
    });
  }
  
  console.log('');
  console.log('Placeholders Sheet Analysis:');
  
  const zip = new JSZip();
  await zip.loadAsync(fileBuffer);
  const sheet2Xml = await zip.file('xl/worksheets/sheet2.xml')?.async('string');
  
  if (!sheet2Xml) {
    console.log('❌ sheet2.xml NOT FOUND');
    return;
  }

  // Extract key cells
  const rowPattern = /<row r="(\d+)"[^>]*>[\s\S]*?<\/row>/g;
  const rows = [];
  let match;
  
  while ((match = rowPattern.exec(sheet2Xml)) !== null) {
    const rowNum = parseInt(match[1]);
    if (rowNum > 19) continue; // Only look at rows 1-19
    
    const rowContent = match[0];
    
    // Extract cells
    const cellPattern = /<c r="([A-Z]+\d+)"[^>]*>[\s\S]*?<\/c>/g;
    let cellMatch;
    
    while ((cellMatch = cellPattern.exec(rowContent)) !== null) {
      const cellRef = cellMatch[1];
      const fullCell = cellMatch[0];
      
      const vMatch = fullCell.match(/<v>([^<]*)<\/v>/);
      const isMatch = fullCell.match(/<is><t>([^<]*)<\/t><\/is>/);
      const value = vMatch ? vMatch[1] : (isMatch ? isMatch[1] : null);
      
      rows.push({ cellRef, value });
    }
  }

  console.log('Placeholders data (key fields):');
  rows.forEach(r => {
    if (r.cellRef === 'B1' || r.cellRef === 'B4' || r.cellRef === 'B10' || r.cellRef === 'B12') {
      const displayValue = r.value === null || r.value === '' ? '(EMPTY)' : r.value.substring(0, 40);
      console.log('  ' + r.cellRef + ': ' + displayValue);
    }
  });
})();
