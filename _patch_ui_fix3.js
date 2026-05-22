const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8');

// These are the exact lines 2409-2420 (0-indexed: 2408-2419) to remove
// We match by the exact content of lines 2409 through 2420
const LEFTOVER = 
  '\n                            const wKey = `${fc.uuid}:waybillSum`;' +
  '\n                            const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);' +
  '\n                            totMetricTds.push(' +
  '\n                              <td' +
  '\n                                key={wKey}' +
  '\n                                className="px-3 py-2 text-right tabular-nums border-r border-gray-200 bg-amber-100 text-amber-900"' +
  '\n                                style={{ width: wColW, maxWidth: wColW }}' +
  '\n                              >' +
  '\n                                {waybillTotal !== 0 ? <span>{formatMoney(waybillTotal)}</span> : <span className="text-gray-400">\u2014</span>}' +
  '\n                              </td>' +
  '\n                            );' +
  '\n                          }';

if (src.includes(LEFTOVER)) {
  src = src.replace(LEFTOVER, '');
  console.log('Step 1 (remove leftover): OK');
} else {
  console.error('LEFTOVER not found — trying byte inspection');
  const idx = src.indexOf('totMetricTds.push(');
  if (idx !== -1) {
    console.log('totMetricTds.push found at char', idx);
    const bytes = Buffer.from(src.slice(idx - 200, idx + 20));
    console.log('hex around totMetricTds:', bytes.toString('hex').slice(0, 200));
  }
  process.exit(1);
}

// Fix totalTds -> totMetricTds
const OLD = '                            totalTds.push(';
const NEW = '                            totMetricTds.push(';
if (src.includes(OLD)) {
  src = src.replace(OLD, NEW);
  console.log('Step 2 (totalTds->totMetricTds): OK');
} else {
  console.log('Step 2: already correct or not found');
}

fs.writeFileSync('components/figma/projects-report-table.tsx', src);
console.log('Done.');
