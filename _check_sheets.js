const XLSX = require('xlsx');

const file = XLSX.readFile('public/handover template.xlsx');
console.log('Sheets in template:', file.SheetNames);
file.SheetNames.forEach(name => {
  console.log(`\nSheet: "${name}"`);
});
