const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
// Find ALL_METRICS, NON_ADDITIVE, selectedMetrics, second header row (metric sub-columns), and cell value rendering
const markers = [
  'ALL_METRICS',
  'NON_ADDITIVE_METRICS',
  'selectedMetrics',
  'activeMetrics.map',
  '{/* Row 2',
  'colSpan={activeMetrics',
];
for (const m of markers) {
  const idx = src.indexOf(m);
  if (idx !== -1) {
    console.log(`\n=== ${m} ===`);
    console.log(src.slice(idx, idx + 400));
  }
}
