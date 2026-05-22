const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
// Find how metric columns are rendered - look for thead/th patterns
const idx = src.indexOf('selectedMetrics.map');
if (idx !== -1) { console.log('=== selectedMetrics.map ===\n', src.slice(idx, idx+400)); }

// Also find where cell values are rendered
const idx2 = src.indexOf('effectiveValue');
if (idx2 !== -1) { console.log('\n=== effectiveValue usage ===\n', src.slice(idx2, idx2+600)); }
