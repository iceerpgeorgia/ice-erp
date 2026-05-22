const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// After cellMap building, get the fcSource/fcList part and return statement
const idx = src.indexOf('function buildPivot');
const end = src.indexOf('\n  }', idx + 100);
// Find the return statement
const ret = src.indexOf('return { jobList, fcList', idx);
console.log('=== buildPivot return area ===');
console.log(src.slice(ret - 200, ret + 120));
