const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Check waybillFcSet computation
const idx = src.indexOf('waybillFcSet');
let pos = 0;
while ((pos = src.indexOf('waybillFcSet', pos)) !== -1) {
  const line = src.slice(0, pos).split('\n').length;
  console.log(`line ${line}: ${src.slice(Math.max(0,pos-20), pos+80).replace(/\n/g,'↵')}`);
  pos += 12;
}

// Check the waybill th header
const idx2 = src.indexOf('title="Waybills"');
console.log('\n=== Waybills th header ===');
console.log(src.slice(idx2 - 20, idx2 + 200));
