const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');

// Find queryParams definition
const idx = src.indexOf('queryParams');
let pos = 0;
while ((pos = src.indexOf('queryParams', pos)) !== -1) {
  const lineNum = src.slice(0, pos).split('\n').length;
  if (lineNum < 100) {
    console.log(`line ${lineNum}: ${lines[lineNum-1].trim()}`);
  }
  pos += 10;
}
// Print lines 60-90 for context
console.log('\n=== lines 55-100 ===');
for (let i = 54; i < 100; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
