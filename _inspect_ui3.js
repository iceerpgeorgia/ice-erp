const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
// Find the table header rendering
const idx = src.indexOf('<th');
const head_section = src.slice(idx, idx + 3000);
console.log('=== First 3000 chars from first <th> ===');
console.log(head_section);
