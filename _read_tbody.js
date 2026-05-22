const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Find all flatMap occurrences with cellMap.get to find the body cell renderer
let pos = 0;
let count = 0;
while (true) {
  const idx = src.indexOf('fcList.flatMap', pos);
  if (idx === -1) break;
  count++;
  const snippet = src.slice(idx, idx + 300);
  if (snippet.includes('cellMap.get') || snippet.includes('getCellValue')) {
    console.log(`=== MATCH at ${idx} ===`);
    console.log(JSON.stringify(src.slice(idx, idx + 500)));
  }
  pos = idx + 1;
}
console.log('Total fcList.flatMap occurrences:', count);
