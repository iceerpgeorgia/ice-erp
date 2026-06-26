const XLSX = require('xlsx');
const fs = require('fs');

console.log('=== CHECKING PLACEHOLDERS SHEET ===');
console.log('');

const filePath = 'd:/export-test.xlsx';
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer);

const placeholdersSheet = workbook.Sheets['Placeholders'];

if (!placeholdersSheet) {
  console.log('❌ NO PLACEHOLDERS SHEET');
  return;
}

console.log('Placeholders sheet content:');
console.log('');

// Read all cells in Placeholders sheet
const range = XLSX.utils.decode_range(placeholdersSheet['!ref']);

for (let row = 0; row <= Math.min(19, range.e.r); row++) {
  const cellA = placeholdersSheet['A' + (row + 1)];
  const cellB = placeholdersSheet['B' + (row + 1)];
  
  const labelA = cellA ? (cellA.v || cellA.f || '') : '';
  const valueB = cellB ? (cellB.v || cellB.f || '') : '';
  
  if (labelA || valueB) {
    console.log((row + 1) + '. [' + labelA + '] => [' + JSON.stringify(valueB).substring(0, 50) + ']');
  }
}

console.log('');
console.log('Issue detected:');
console.log('If B column is empty or has placeholder text (z, lorem, etc), then data is NOT being populated');
console.log('This would explain why the sheet appears blank to the user');
