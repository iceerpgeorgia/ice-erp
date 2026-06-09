const XLSX = require('xlsx');

const wb = XLSX.readFile('public/handover template.xlsx');
const ws = wb.Sheets['Placeholders'];

console.log('Placeholders sheet column A and B:');
console.log('='.repeat(80));

for (let row = 1; row <= 25; row++) {
  const aCell = ws[XLSX.utils.encode_cell({r: row-1, c: 0})];
  const bCell = ws[XLSX.utils.encode_cell({r: row-1, c: 1})];
  
  const aVal = aCell ? aCell.v : null;
  const bVal = bCell ? bCell.v : null;
  
  if (aVal || bVal) {
    console.log(`Row ${row}: A="${aVal}" | B="${bVal}"`);
  }
}
