const fs = require('fs');
const path = 'c:\\next-postgres-starter\\app\\api\\payments-report\\route.ts';
let content = fs.readFileSync(path, 'utf8');

// Remove the duplicate isBundlePayment line (line 202)
const lines = content.split('\n');
const lineIndex = lines.findIndex((line, idx) => idx > 195 && line.includes('isBundlePayment: row.is_bundle_payment'));

if (lineIndex !== -1) {
  // Find the next occurrence
  const nextIndex = lines.findIndex((line, idx) => idx > lineIndex && line.includes('isBundlePayment: row.is_bundle_payment'));
  if (nextIndex !== -1) {
    lines.splice(nextIndex, 1);
    console.log('Removed duplicate isBundlePayment at line ' + (nextIndex + 1));
  }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed payments-report route.ts');