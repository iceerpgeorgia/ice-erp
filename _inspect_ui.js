const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
// Find MetricKey, METRIC_LABELS, and column header rendering
const idx1 = src.indexOf('type MetricKey');
const idx2 = src.indexOf('METRIC_LABELS');
const idx3 = src.indexOf('waybillSum');
console.log('=== MetricKey ===');
console.log(src.slice(idx1, idx1 + 300));
console.log('\n=== METRIC_LABELS ===');
console.log(src.slice(idx2, idx2 + 400));
console.log('\n=== waybillSum occurrences ===');
let pos = 0;
while ((pos = src.indexOf('waybillSum', pos)) !== -1) {
  console.log('  line ~', src.slice(0, pos).split('\n').length, ':', src.slice(Math.max(0, pos-30), pos+60).replace(/\n/g,'↵'));
  pos += 10;
}
