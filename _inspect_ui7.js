const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
// Find cell value rendering in tbody
const idx = src.indexOf('{/* Row 2: metric sub-headers');
const section = src.slice(idx, idx + 2500);
console.log(section);
