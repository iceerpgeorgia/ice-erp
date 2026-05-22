const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8');

// Fix 1: Remove leftover old totals code (lines between "}" after our new block and "return totMetricTds")
// The leftover is the code block starting from the redundant const wKey line
const OLD_LEFTOVER = `          }
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
          }
          return totMetricTds;`;
const NEW_LEFTOVER = `          }
          return totMetricTds;`;
if (src.includes(OLD_LEFTOVER)) {
  src = src.replace(OLD_LEFTOVER, NEW_LEFTOVER);
  console.log('Fix 1 (remove leftover totals code): OK');
} else {
  // Try with em-dash literal
  const OLD2 = `          }
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
          }
          return totMetricTds;`;
  if (src.includes(OLD2)) {
    src = src.replace(OLD2, NEW_LEFTOVER);
    console.log('Fix 1b (remove leftover totals code with em-dash): OK');
  } else {
    console.error('Leftover not found - checking manually');
    const idx = src.indexOf('return totMetricTds;');
    console.log('Context before return totMetricTds:', JSON.stringify(src.slice(idx-400, idx+30)));
  }
}

// Fix 2: Change totalTds.push to totMetricTds.push in the new waybill totals block
const OLD_PUSH = '          if (waybillFcMap.has(fc.uuid)) {\n            // Waybill total comes from project-level aggregate (not summed per-job)\n            const waybillTotal = proj.waybillSum;\n            const wKey = `${fc.uuid}:waybillSum`;\n            const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);\n            totalTds.push(';
const NEW_PUSH = '          if (waybillFcMap.has(fc.uuid)) {\n            // Waybill total comes from project-level aggregate (not summed per-job)\n            const waybillTotal = proj.waybillSum;\n            const wKey = `${fc.uuid}:waybillSum`;\n            const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);\n            totMetricTds.push(';
if (src.includes(OLD_PUSH)) {
  src = src.replace(OLD_PUSH, NEW_PUSH);
  console.log('Fix 2 (totalTds→totMetricTds): OK');
} else {
  // check if already correct
  if (src.includes('totMetricTds.push(\n              <td\n                key={`total:')) {
    console.log('Fix 2: already uses totMetricTds');
  } else {
    console.error('Push target not found');
  }
}

// Fix 3: Fix the key in the totals waybill td to not have "total:" prefix (avoid key collision)
const OLD_KEY = 'key={`total:${fc.uuid}:waybillSum`}';
const NEW_KEY = 'key={`${fc.uuid}:waybillSum:total`}';
if (src.includes(OLD_KEY)) {
  src = src.replace(OLD_KEY, NEW_KEY);
  console.log('Fix 3 (fix td key): OK');
}

fs.writeFileSync('components/figma/projects-report-table.tsx', src);
console.log('\nFix patches applied.');
