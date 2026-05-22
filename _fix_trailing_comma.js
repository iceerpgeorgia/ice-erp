const fs = require('fs');
let src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8');

const OLD = '        MAX(la.latest_ledger_date) AS latest_date,\r\n      FROM selected_payments sp';
const NEW = '        MAX(la.latest_ledger_date) AS latest_date\r\n      FROM selected_payments sp';

if (src.includes(OLD)) {
  src = src.replace(OLD, NEW);
  console.log('Fix applied: removed trailing comma before FROM');
} else {
  // Try LF version
  const OLD2 = '        MAX(la.latest_ledger_date) AS latest_date,\n      FROM selected_payments sp';
  const NEW2 = '        MAX(la.latest_ledger_date) AS latest_date\n      FROM selected_payments sp';
  if (src.includes(OLD2)) {
    src = src.replace(OLD2, NEW2);
    console.log('Fix applied (LF): removed trailing comma before FROM');
  } else {
    console.error('Pattern not found!');
    process.exit(1);
  }
}

fs.writeFileSync('app/api/projects-report/route.ts', src);
console.log('Done.');
