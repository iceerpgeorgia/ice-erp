const XLSX = require('xlsx');
const wb = XLSX.readFile('public/handover template.xlsx', { cellFormula: true, cellNF: true, cellStyles: true, sheetStubs: true });
console.log('Sheets in template:', wb.SheetNames);
console.log('Total sheets:', wb.SheetNames.length);
wb.SheetNames.forEach(name => {
  const sheet = wb.Sheets[name];
  const keys = Object.keys(sheet).length;
  console.log('  ' + name + ': ' + keys + ' cells');
});

// Write it back to see if all sheets are preserved
const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
const wb2 = XLSX.read(buf, { cellFormula: true, cellNF: true, cellStyles: true, sheetStubs: true });
console.log('\nAfter write/read cycle:');
console.log('Sheets in output:', wb2.SheetNames);
