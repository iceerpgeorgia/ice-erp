const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Read CellData completely - look for waybillSum through pairedFcCode
const idx = src.indexOf('type CellData = {');
console.log(src.slice(idx, idx + 800));
