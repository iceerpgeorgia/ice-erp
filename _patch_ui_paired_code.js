const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// ── Step 1: Add pairedFcCode + pairedFcValidation to CellData type ──────────
const OLD_CD = '  waybillSum: number;\n};';
const NEW_CD = `  waybillSum: number;
  pairedFcCode: string | null;
  pairedFcValidation: string | null;
};`;
const c1 = src.split(OLD_CD).length - 1;
if (c1 !== 1) { console.error('Step 1 count:', c1); process.exit(1); }
src = src.replace(OLD_CD, NEW_CD);
console.log('Step 1: pairedFcCode + pairedFcValidation added to CellData');

// ── Step 2: Change waybillFcSet (Set) → waybillFcMap (Map: income fc uuid → paired code) ──
const OLD_SET = `    const waybillFcSet = new Set<string>(
      fcList
        .filter((fc) => [...cellMap.values()].some((c) => c.financialCodeUuid === fc.uuid && c.waybillSum > 0))
        .map((fc) => fc.uuid)
    );
    return { jobList, fcList, cellMap, waybillFcSet };`;

const NEW_SET = `    // Map: income FC uuid → paired cost FC code (for waybill column label)
    const waybillFcMap = new Map<string, string>();
    for (const fc of fcList) {
      const cell = [...cellMap.values()].find((c) => c.financialCodeUuid === fc.uuid && c.waybillSum > 0);
      if (cell?.pairedFcCode) waybillFcMap.set(fc.uuid, cell.pairedFcCode);
    }
    return { jobList, fcList, cellMap, waybillFcMap };`;

const c2 = src.split(OLD_SET).length - 1;
if (c2 !== 1) { console.error('Step 2 count:', c2); process.exit(1); }
src = src.replace(OLD_SET, NEW_SET);
console.log('Step 2: waybillFcSet → waybillFcMap');

// ── Step 3: Update all destructures: waybillFcSet → waybillFcMap ─────────────
let replaceCount = 0;
src = src.replace(/waybillFcSet \} = (buildPivot\(|useMemo\(\(\) => buildPivot\()/g, (m, p1) => {
  replaceCount++;
  return `waybillFcMap } = ${p1}`;
});
console.log('Step 3: updated', replaceCount, 'destructures');

// ── Step 4: Update all .has(fc.uuid) calls → waybillFcMap.has(fc.uuid) ───────
let hasCount = 0;
src = src.replace(/waybillFcSet\.has\(/g, () => { hasCount++; return 'waybillFcMap.has('; });
console.log('Step 4: replaced', hasCount, 'waybillFcSet.has() calls');

// ── Step 5: Update column header to show paired FC code ──────────────────────
const OLD_HDR = `                            const wKey = \`\${fc.uuid}:waybillSum\`;
                            const wAutoW = autoColWidthsMap.get(wKey) ?? 60;
                            const wColW = getColWidth(wKey, wAutoW);
                            metricThs.push(
                              <th
                                key={wKey}
                                title="Waybills"
                                className="relative overflow-hidden px-2 py-1 text-center text-[10px] font-medium text-amber-700 border-r border-gray-200 bg-amber-50"
                                style={{ width: wColW, minWidth: wColW }}
                              >
                                <span className="truncate block">Waybills</span>
                                <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, wKey, wAutoW)} />
                              </th>
                            );`;

const NEW_HDR = `                            const wKey = \`\${fc.uuid}:waybillSum\`;
                            const wAutoW = autoColWidthsMap.get(wKey) ?? 60;
                            const wColW = getColWidth(wKey, wAutoW);
                            const pairedCode = waybillFcMap.get(fc.uuid) ?? 'Waybills';
                            metricThs.push(
                              <th
                                key={wKey}
                                title={pairedCode}
                                className="relative overflow-hidden px-2 py-1 text-center text-[10px] font-medium text-amber-700 border-r border-gray-200 bg-amber-50"
                                style={{ width: wColW, minWidth: wColW }}
                              >
                                <span className="truncate block">{pairedCode}</span>
                                <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, wKey, wAutoW)} />
                              </th>
                            );`;

const c5 = src.split(OLD_HDR).length - 1;
if (c5 !== 1) { console.error('Step 5 count:', c5); process.exit(1); }
src = src.replace(OLD_HDR, NEW_HDR);
console.log('Step 5: column header updated to show paired FC code');

fs.writeFileSync('components/figma/projects-report-table.tsx', src, 'utf8');
console.log('UI patch done.');
