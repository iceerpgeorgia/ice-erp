const fs = require('fs');

const compFile = 'components/figma/projects-report-table.tsx';
const fnFile = '_new_export_fn.txt';

let src = fs.readFileSync(compFile, 'utf8');
let newFn = fs.readFileSync(fnFile, 'utf8');

// Normalise new function to match file line endings (CRLF)
const fileIsCRLF = src.includes('\r\n');
if (fileIsCRLF) {
  newFn = newFn.replace(/\r?\n/g, '\r\n');
}

// Find the start of handleExport
const START_MARKER = '  const handleExport = () => {';
const si = src.indexOf(START_MARKER);
if (si < 0) { console.error('MISS: handleExport not found'); process.exit(1); }

// Find closing }; using brace counting
let depth = 0;
let ei = si;
for (let i = si; i < src.length; i++) {
  const ch = src[i];
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) {
      ei = i + 1;
      // skip optional semicolon + line ending
      if (src[ei] === ';') ei++;
      if (src[ei] === '\r') ei++;
      if (src[ei] === '\n') ei++;
      break;
    }
  }
}

const oldFn = src.slice(si, ei);
console.log('Replacing lines', src.slice(0, si).split('\n').length, 'to', src.slice(0, ei).split('\n').length);

src = src.slice(0, si) + newFn + src.slice(ei);
fs.writeFileSync(compFile, src, 'utf8');
console.log('Done.');
