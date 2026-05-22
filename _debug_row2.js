const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Find Row 2 header
const idx = src.indexOf('{/* Row 2: metric sub-headers */}');
console.log('=== Row 2 header (500 chars) ===');
console.log(src.slice(idx, idx + 1800));
