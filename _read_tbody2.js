const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Find flatMap that renders <td elements
let pos = 0;
while (true) {
  const idx = src.indexOf('fcList.flatMap', pos);
  if (idx === -1) break;
  const snippet = src.slice(idx, idx + 600);
  if (snippet.includes('<td')) {
    console.log('=== JSX flatMap at', idx, '===');
    // Show more context
    console.log(JSON.stringify(src.slice(idx - 80, idx + 1200)));
    console.log('---');
  }
  pos = idx + 1;
}
