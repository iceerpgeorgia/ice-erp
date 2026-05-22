const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// Show how cells are pushed including waybillSum
const idx = src.indexOf('cells.push({');
if (idx !== -1) {
  console.log('=== cells.push ===');
  console.log(src.slice(idx, idx + 600));
}

// Also look for where the query is executed (pg.query call)
const idx2 = src.indexOf('await localClient.query(');
let pos = 0;
while ((pos = src.indexOf('localClient.query(', pos)) !== -1) {
  console.log('\n=== localClient.query at line', src.slice(0,pos).split('\n').length, '===');
  console.log(src.slice(pos, pos + 200));
  pos += 18;
  if (pos > 999999) break;
}
