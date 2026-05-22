const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8');

// The leftover block: old totMetricTds.push code that survived the replacement
// It starts right after the closing } of our new if block, before "return totMetricTds"
// Exact content from lines 2409-2420:
const LEFTOVER = `
            const wKey = \`\${fc.uuid}:waybillSum\`;
            const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);
            totMetricTds.push(
              <td
                key={wKey}
                className="px-3 py-2 text-right tabular-nums border-r border-gray-200 bg-amber-100 text-amber-900"
                style={{ width: wColW, maxWidth: wColW }}
              >
                {waybillTotal !== 0 ? <span>{formatMoney(waybillTotal)}</span> : <span className="text-gray-400">\u2014</span>}
              </td>
            );
          }`;
if (src.includes(LEFTOVER)) {
  src = src.replace(LEFTOVER, '');
  console.log('Step 1 (remove leftover block with unicode em-dash): OK');
} else {
  // Try with literal em-dash
  const LEFTOVER2 = `
            const wKey = \`\${fc.uuid}:waybillSum\`;
            const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);
            totMetricTds.push(
              <td
                key={wKey}
                className="px-3 py-2 text-right tabular-nums border-r border-gray-200 bg-amber-100 text-amber-900"
                style={{ width: wColW, maxWidth: wColW }}
              >
                {waybillTotal !== 0 ? <span>{formatMoney(waybillTotal)}</span> : <span className="text-gray-400">—</span>}
              </td>
            );
          }`;
  if (src.includes(LEFTOVER2)) {
    src = src.replace(LEFTOVER2, '');
    console.log('Step 1 (remove leftover block literal em-dash): OK');
  } else {
    // Find it by landmarks
    const START_MARKER = '            const wKey = `${fc.uuid}:waybillSum`;\n            const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);\n            totMetricTds.push(';
    const idx = src.indexOf(START_MARKER);
    if (idx === -1) { console.error('Leftover START_MARKER not found'); process.exit(1); }
    // Find the end: "          }" followed by newline
    const END_MARKER = '\n          }';
    const endIdx = src.indexOf(END_MARKER, idx);
    if (endIdx === -1) { console.error('Leftover END_MARKER not found'); process.exit(1); }
    // Remove from just before START_MARKER's preceding newline through END_MARKER
    const removeFrom = src.lastIndexOf('\n', idx - 1); // newline before START_MARKER
    const removeTo = endIdx + END_MARKER.length;
    src = src.slice(0, removeFrom) + src.slice(removeTo);
    console.log('Step 1 (remove leftover by landmark): OK');
  }
}

// Fix totalTds.push -> totMetricTds.push in the new waybill totals block
const OLD_TOTALTDS = '            totalTds.push(';
const NEW_TOTALTDS = '            totMetricTds.push(';
if (src.includes(OLD_TOTALTDS)) {
  src = src.replace(OLD_TOTALTDS, NEW_TOTALTDS);
  console.log('Step 2 (totalTds->totMetricTds): OK');
} else {
  console.log('Step 2: totalTds.push not found (may already be correct)');
}

fs.writeFileSync('components/figma/projects-report-table.tsx', src);
console.log('\nFix applied.');
