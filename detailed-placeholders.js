const XLSX = require('xlsx');
const fs = require('fs');

console.log('=== DETAILED PLACEHOLDERS ANALYSIS ===');
console.log('');

const filePath = 'd:/export-test.xlsx';
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer);

const placeholdersSheet = workbook.Sheets['Placeholders'];
const range = XLSX.utils.decode_range(placeholdersSheet['!ref']);

console.log('All Placeholders rows (A = label, B = value):');
console.log('');

for (let row = 0; row <= Math.min(19, range.e.r); row++) {
  const cellA = placeholdersSheet['A' + (row + 1)];
  const cellB = placeholdersSheet['B' + (row + 1)];
  
  const labelA = cellA ? (cellA.v || cellA.f || '(empty)') : '(missing)';
  const valueB = cellB ? (cellB.v || cellB.f || '(empty)') : '(missing)';
  
  console.log((row + 1) + '. [' + labelA + '] = [' + valueB + ']');
}

console.log('');
console.log('ISSUE: Any rows where B value is empty will cause the Handover formulas to fail');
console.log('because the VLOOKUP will not find a value and the formula will show blank.');
