const XLSX = require('xlsx');
const path = require('path');

// Read template from public folder
const templatePath = path.join(process.cwd(), 'public', 'handover template.xlsx');
const wb = XLSX.readFile(templatePath);
const sheet = wb.Sheets['Placeholders'];

console.log('=== ALL PLACEHOLDERS ===');
console.log('');

// Column A has labels, Column B has values
// Extract rows
const rows = {};
Object.keys(sheet).forEach(cellRef => {
  if (cellRef.startsWith('!')) return;
  const cell = sheet[cellRef];
  const cellValue = cell.v || cell.h || '';
  if (cellValue && cellValue.toString().trim()) {
    rows[cellRef] = cellValue;
  }
});

// Sort and display
Object.keys(rows)
  .sort()
  .forEach(ref => {
    console.log(`${ref}: ${rows[ref]}`);
  });
