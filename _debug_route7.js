const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');
const idx = src.indexOf('cells.push({');
console.log(src.slice(idx + 1350, idx + 1550));
