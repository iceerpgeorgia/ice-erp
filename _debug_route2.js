const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// Show the full SQL query around projectPlaceholders to understand parameter binding
const idx = src.indexOf('projectPlaceholders');
console.log('=== projectPlaceholders first occurrence (context) ===');
console.log(src.slice(Math.max(0, idx - 400), idx + 200));
console.log('\n--- all occurrences ---');
let pos = 0;
while ((pos = src.indexOf('projectPlaceholders', pos)) !== -1) {
  console.log('  line', src.slice(0,pos).split('\n').length, ':', src.slice(Math.max(0,pos-50), pos+80).replace(/\n/g,'↵'));
  pos += 19;
}
