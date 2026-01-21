const XLSX = require('xlsx');

console.log('Analyzing currencies in salary template...\n');

const wb = XLSX.readFile('templates/salary_accruals_import_template.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

const currencies = [...new Set(data.map(r => r.nominal_currency_uuid))];

console.log('Unique currencies found:', currencies);
console.log('\nCount by currency:');

currencies.forEach(c => {
  const count = data.filter(r => r.nominal_currency_uuid === c).length;
  console.log(`  ${c}: ${count} records`);
});

console.log(`\nTotal records: ${data.length}`);
