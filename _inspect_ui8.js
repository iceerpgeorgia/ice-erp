const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
// Find cell value rendering (td) in tbody - after the sticky td
const idx = src.indexOf('{fcList.map((fc) => {');
const section = src.slice(idx, idx + 1500);
console.log(section);
