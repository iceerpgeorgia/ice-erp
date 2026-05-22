const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');

// Count JSX-style brace balance to find where it goes negative
let depth = 0;
let inStr = false;
let strChar = '';
let inLineComment = false;
let inBlockComment = false;
let inTemplateLit = 0;

// Simple brace counter (not perfect but good enough)
let braceDepth = 0;
let prevDepth = 0;

for (let li = 0; li < lines.length; li++) {
  const line = lines[li];
  prevDepth = braceDepth;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let escaped = false;
  
  for (let ci = 0; ci < line.length; ci++) {
    const ch = line[ci];
    const next = line[ci + 1];
    
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    
    // Handle comments
    if (!inSingleQuote && !inDoubleQuote && !inTemplate) {
      if (ch === '/' && next === '/') break; // line comment
    }
    
    // Handle strings
    if (!inDoubleQuote && !inTemplate && ch === "'") { inSingleQuote = !inSingleQuote; continue; }
    if (!inSingleQuote && !inTemplate && ch === '"') { inDoubleQuote = !inDoubleQuote; continue; }
    if (!inSingleQuote && !inDoubleQuote && ch === '`') { inTemplate = !inTemplate; continue; }
    
    if (inSingleQuote || inDoubleQuote || inTemplate) continue;
    
    if (ch === '{') braceDepth++;
    if (ch === '}') braceDepth--;
  }
  
  // Report interesting changes
  if (braceDepth < 0) {
    console.log(`LINE ${li+1}: depth went NEGATIVE (${braceDepth}) - ${line.trim().slice(0,80)}`);
    braceDepth = 0; // reset so we can continue
  } else if (li > 1300 && li < 1500 && braceDepth !== prevDepth) {
    // Show lines in the "component body" area where depth changes
    console.log(`LINE ${li+1}: depth ${prevDepth} -> ${braceDepth}: ${line.trim().slice(0,80)}`);
  }
}

console.log('\nFinal brace depth:', braceDepth);
console.log('Total lines:', lines.length);
