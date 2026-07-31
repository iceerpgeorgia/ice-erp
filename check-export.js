const XLSX = require('xlsx');
const fs = require('fs');

console.log('=== ANALYZING EXPORTED FILE ===');
console.log('');

const filePath = 'd:/export-test.xlsx';
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { cellStyles: true });

console.log('Sheet names: ' + JSON.stringify(workbook.SheetNames));
console.log('');

// Check the first sheet (should be Handover)
const sheet1Name = workbook.SheetNames[0];
const sheet1 = workbook.Sheets[sheet1Name];

console.log('Sheet 1: "' + sheet1Name + '"');
console.log('');

// Get cell range
if (sheet1['!ref']) {
  const range = XLSX.utils.decode_range(sheet1['!ref']);
  console.log('Range: ' + sheet1['!ref']);
  console.log('');

  // Check for any content in first few rows
  console.log('Sample cells:');
  for (let row = 0; row < Math.min(5, range.e.r); row++) {
    for (let col = 0; col < Math.min(5, range.e.c); col++) {
      const cellAddr = XLSX.utils.encode_col(col) + XLSX.utils.encode_row(row);
      const cell = sheet1[cellAddr];
      if (cell) {
        const val = cell.v || cell.f || cell.t;
        console.log('  ' + cellAddr + ': ' + JSON.stringify(val).substring(0, 50));
      }
    }
  }
} else {
  console.log('❌ NO RANGE - Sheet appears EMPTY');
}

console.log('');

// Check for formulas
const formulaCells = [];
for (const cellAddr in sheet1) {
  if (cellAddr.startsWith('!')) continue;
  const cell = sheet1[cellAddr];
  if (cell && cell.f) {
    formulaCells.push({ addr: cellAddr, formula: cell.f });
  }
}

console.log('Formulas found: ' + formulaCells.length);
if (formulaCells.length > 0) {
  console.log('Sample formulas:');
  formulaCells.slice(0, 3).forEach(f => {
    console.log('  ' + f.addr + ': ' + f.formula.substring(0, 60));
  });
} else {
  console.log('❌ NO FORMULAS FOUND - Sheet is BLANK');
}
