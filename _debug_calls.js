const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Find ALL destructures of buildPivot result
let pos = 0;
while (true) {
  const idx = src.indexOf('buildPivot(', pos);
  if (idx === -1) break;
  const line = src.slice(0, idx).split('\n').length;
  console.log(`\n=== buildPivot call at line ${line} ===`);
  console.log(src.slice(Math.max(0, idx - 100), idx + 150));
  pos = idx + 10;
}
