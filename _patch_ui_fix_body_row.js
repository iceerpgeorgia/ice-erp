const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8');

// The body row's if block closes at line 2362, then immediately 
// the jobList.map closes at line 2363 — but that's wrong.
// Between those, we're missing:
//   1. return metricTds;      (30 spaces, inside fcList.flatMap callback)
//   2. })}                    (28 spaces, closes {fcList.flatMap...})
//   3. </tr>                  (26 spaces, closes the body <tr>)
//   4. );                     (24 spaces, closes return ()
// Then the 22-space })} correctly closes {jobList.map...}

// Find the closing } of the waybill if block in body row, 
// followed by the wrong-indentation })} at 22 spaces.
// The if block's } is at 30 spaces, the jobList.map close is at 22 spaces.

const OLD = 
  '\n                              }' +  // line 2362: closes `if (waybillFcMap.has)` block (30 spaces)
  '\n                      })}';          // line 2363: closes {jobList.map} (22 spaces)

const NEW =
  '\n                              }' +          // close if block (30 spaces)
  '\n                              return metricTds;' + // return inside flatMap callback (30 spaces)
  '\n                            })}' +          // close {fcList.flatMap} (28 spaces)
  '\n                          </tr>' +          // close body <tr> (26 spaces)
  '\n                        );' +               // close return ( (24 spaces)
  '\n                      })}';                 // close {jobList.map} (22 spaces)

if (src.includes(OLD)) {
  // Verify this OLD pattern only appears once in the body row context
  const count = src.split(OLD).length - 1;
  if (count > 1) {
    console.error(`Pattern found ${count} times - need more unique anchor`);
    process.exit(1);
  }
  src = src.replace(OLD, NEW);
  console.log('Fix applied (body row flatMap structure restored): OK');
} else {
  console.error('OLD pattern not found!');
  // Debug: check what follows the if-close
  const ifClose = '                              }';
  const idx = src.indexOf('\n' + ifClose + '\n                      })}');
  if (idx === -1) {
    // Show context around line 2362 equivalent
    const lineIdx = src.indexOf('\n                              }\n                      })}');
    console.log('Alternative search:', lineIdx !== -1 ? 'found' : 'not found');
    
    // Look for the 22-space })} preceded by only if-close
    const altIdx = src.indexOf('                              }\n                      })}');
    console.log('altIdx:', altIdx);
    if (altIdx !== -1) console.log('Context:', JSON.stringify(src.slice(altIdx - 50, altIdx + 60)));
  }
  process.exit(1);
}

fs.writeFileSync('components/figma/projects-report-table.tsx', src);
console.log('Done. File saved.');
