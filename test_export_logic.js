const XLSX = require('xlsx');
const fs = require('fs');

console.log('=== Testing Export Logic ===');

// Read original
const orig = fs.readFileSync('public/handover template.xlsx');
const origWb = XLSX.read(orig, {cellFormula:true, cellNF:true, cellStyles:true, sheetStubs:true});
console.log('Original B2:', JSON.stringify(origWb.Sheets['Placeholders']['B2']));
console.log('Original B4:', JSON.stringify(origWb.Sheets['Placeholders']['B4']));
console.log('Original B12:', JSON.stringify(origWb.Sheets['Placeholders']['B12']));

// Simulate what route.ts does
const wb = XLSX.read(orig, {cellFormula:true, cellNF:true, cellStyles:true, sheetStubs:true});
const sheet = wb.Sheets['Placeholders'];

const setCell = (cellRef, value, type) => {
  if (!sheet[cellRef]) sheet[cellRef] = {};
  sheet[cellRef].v = value;
  sheet[cellRef].t = type;
};

// Fill
const dateObj = new Date('2024-01-15T10:00:00');
const excelSerial = Math.floor((dateObj.getTime() - new Date(1900, 0, 1).getTime()) / (24 * 60 * 60 * 1000)) + 2;
console.log('Setting B2 to serial:', excelSerial);
setCell('B2', excelSerial, 'n');
setCell('B4', 'TEST_COUNTERAGENT_123', 's');
setCell('B12', 'TEST_COMPANY_456', 's');

console.log('\nAfter setCell:');
console.log('B2:', JSON.stringify(sheet['B2']));
console.log('B4:', JSON.stringify(sheet['B4']));
console.log('B12:', JSON.stringify(sheet['B12']));

// Write
const buf = XLSX.write(wb, {type: 'buffer', bookType: 'xlsx'});
fs.writeFileSync('test_local_export.xlsx', buf);

// Read back
const wb2 = XLSX.read(buf, {cellFormula:true, cellNF:true, cellStyles:true, sheetStubs:true});
console.log('\nAfter XLSX.write/read:');
console.log('B2:', JSON.stringify(wb2.Sheets['Placeholders']['B2']));
console.log('B4:', JSON.stringify(wb2.Sheets['Placeholders']['B4']));
console.log('B12:', JSON.stringify(wb2.Sheets['Placeholders']['B12']));

console.log('\nFile size: original', orig.length, 'bytes, output', buf.length, 'bytes');
