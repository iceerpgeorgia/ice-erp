const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.env.USERPROFILE, 'Downloads', 'handovers-Alliance Highline _ 1.1.1 _ ალიანსი თბილისი _ 2,281,058.00 _ USD _ 21.01.2022-2026-11-05.xlsx');
console.log(`Reading file: ${filePath}`);
const workbook = XLSX.readFile(filePath);

console.log('Available sheets:', workbook.SheetNames);

// Check each sheet for data
workbook.SheetNames.forEach(name => {
  const sheet = workbook.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`\n=== Sheet: ${name} ===`);
  console.log(`Total rows: ${data.length}`);
  
  if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    
    // If this is Job Distributions, show all rows with key data
    if (name === 'Job Distributions') {
      console.log('\nAll Job Distribution rows:');
      data.forEach((row, idx) => {
        console.log(`Row ${idx + 1}:`, {
          date: row['Date'] || row['date'] || row['Transaction Date'],
          job: row['Job'] || row['job'] || row['Job Name'],
          nominalAmount: row['Nominal Amount'] || row['nominal'] || row['Amount'],
          distributedAmount: row['Distributed Amount'] || row['Amount (Distributed)'] || row['amount_account_curr'],
          paymentId: row['Payment ID'] || row['payment_id'],
          batchId: row['Batch ID'] || row['batch_id']
        });
      });
      
      // Try to find totals
      console.log('\n\nGrouping by Date/Payment to check totals:');
      const grouped = {};
      
      data.forEach(row => {
        const date = row['Date'] || row['date'] || row['Transaction Date'] || 'unknown';
        const paymentId = row['Payment ID'] || row['payment_id'] || 'unknown';
        const key = `${date}_${paymentId}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            date,
            paymentId,
            nominalAmount: 0,
            distributedAmount: 0,
            rows: []
          };
        }
        
        // Try multiple column names
        let nominalVal = row['Nominal Amount'] || row['nominal'] || row['Amount'] || row['amount'] || 0;
        let distributedVal = row['Distributed Amount'] || row['Amount (Distributed)'] || row['amount_account_curr'] || row['amountAccountCurr'] || 0;
        
        nominalVal = parseFloat(nominalVal) || 0;
        distributedVal = parseFloat(distributedVal) || 0;
        
        grouped[key].nominalAmount += nominalVal;
        grouped[key].distributedAmount += distributedVal;
        grouped[key].rows.push({
          job: row['Job'] || row['job'] || row['Job Name'] || 'unknown',
          nominalVal,
          distributedVal
        });
      });
      
      Object.entries(grouped).forEach(([key, group]) => {
        const diff = group.distributedAmount - group.nominalAmount;
        console.log(`\nDate: ${group.date}, Payment: ${group.paymentId}`);
        console.log(`  Nominal Total: ${group.nominalAmount}`);
        console.log(`  Distributed Total: ${group.distributedAmount}`);
        console.log(`  Difference: ${diff.toFixed(2)} ${diff !== 0 ? '❌ MISMATCH' : '✓ OK'}`);
        console.log('  Breakdown:');
        group.rows.forEach(r => {
          console.log(`    ${r.job}: ${r.nominalVal} (nominal) -> ${r.distributedVal} (distributed)`);
        });
      });
    }
  }
});
