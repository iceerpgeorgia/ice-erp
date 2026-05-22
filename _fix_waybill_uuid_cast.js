const fs = require('fs');
const path = 'app/api/projects-report/route.ts';
const buf = fs.readFileSync(path);
// Detect EOL
const hasCRLF = buf.includes(Buffer.from('\r\n'));
let src = buf.toString('utf8');
const before = src;
src = src.replace(
  'WHERE proj.project_uuid::text IN (${projectPlaceholders})',
  'WHERE proj.project_uuid IN (${projectPlaceholders})'
);
if (src === before) {
  console.error('NO CHANGE - pattern not found');
  process.exit(1);
}
fs.writeFileSync(path, src);
console.log('Fixed. CRLF preserved:', hasCRLF);
