const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// ── Step 1: Remove 'waybillSum' from MetricKey union ─────────────────────────
const OLD_MK = "type MetricKey = 'accrual' | 'latestAccrual' | 'order' | 'lastMonthAccrual' | 'lastMonthOrder' | 'payment' | 'due' | 'balance' | 'paymentCount' | 'accrualPerFloor' | 'waybillSum';";
const NEW_MK = "type MetricKey = 'accrual' | 'latestAccrual' | 'order' | 'lastMonthAccrual' | 'lastMonthOrder' | 'payment' | 'due' | 'balance' | 'paymentCount' | 'accrualPerFloor';";
const c1 = src.split(OLD_MK).length - 1;
if (c1 !== 1) { console.error('Step 1 count:', c1); process.exit(1); }
src = src.replace(OLD_MK, NEW_MK);
console.log('Step 1: waybillSum removed from MetricKey');

// ── Step 2: Remove waybillSum from METRIC_LABELS ──────────────────────────────
const OLD_ML = "  accrualPerFloor: 'Accrual/Floor',\n  waybillSum: 'Waybills',\n};";
const NEW_ML = "  accrualPerFloor: 'Accrual/Floor',\n};";
const c2 = src.split(OLD_ML).length - 1;
if (c2 !== 1) { console.error('Step 2 count:', c2); process.exit(1); }
src = src.replace(OLD_ML, NEW_ML);
console.log('Step 2: waybillSum removed from METRIC_LABELS');

// ── Step 3: buildPivot return — add waybillFcSet ─────────────────────────────
const OLD_RET = "    return { jobList, fcList, cellMap };\n  }";
const NEW_RET = `    // Compute which FCs have waybill data
    const waybillFcSet = new Set<string>(
      fcList
        .filter((fc) => [...cellMap.values()].some((c) => c.financialCodeUuid === fc.uuid && c.waybillSum > 0))
        .map((fc) => fc.uuid)
    );
    return { jobList, fcList, cellMap, waybillFcSet };
  }`;
const c3 = src.split(OLD_RET).length - 1;
if (c3 !== 1) { console.error('Step 3 count:', c3); process.exit(1); }
src = src.replace(OLD_RET, NEW_RET);
console.log('Step 3: waybillFcSet added to buildPivot return');

// ── Step 4: Update all destructures of buildPivot to include waybillFcSet ────
// There are multiple useMemo calls destructuring buildPivot
const OLD_DESTRUCT = /const \{ jobList, fcList, cellMap \} = (useMemo\(\(\) => buildPivot\(|buildPivot\()/g;
const matches = [...src.matchAll(OLD_DESTRUCT)];
console.log('Step 4: buildPivot destructure occurrences:', matches.length);
src = src.replace(/const \{ jobList, fcList, cellMap \} = (useMemo\(\(\) => buildPivot\(|buildPivot\()/g, (m, p1) => {
  return `const { jobList, fcList, cellMap, waybillFcSet } = ${p1}`;
});
console.log('Step 4: buildPivot destructures updated');

// ── Step 5: FC group header (Row 1) — increase colSpan for waybill FCs ───────
// Current: colSpan={activeMetrics.length}
// We need: colSpan={activeMetrics.length + (waybillFcSet.has(fc.uuid) ? 1 : 0)}
const OLD_COLSPAN = "                          colSpan={activeMetrics.length}\n                            style={{ minWidth: activeMetrics.reduce((s, m) => s + getColWidth(`${fc.uuid}:${m}`, autoColWidthsMap.get(`${fc.uuid}:${m}`) ?? 38), 0) }}";
const NEW_COLSPAN = "                          colSpan={activeMetrics.length + (waybillFcSet.has(fc.uuid) ? 1 : 0)}\n                            style={{ minWidth: activeMetrics.reduce((s, m) => s + getColWidth(`${fc.uuid}:${m}`, autoColWidthsMap.get(`${fc.uuid}:${m}`) ?? 38), 0) + (waybillFcSet.has(fc.uuid) ? getColWidth(`${fc.uuid}:waybillSum`, autoColWidthsMap.get(`${fc.uuid}:waybillSum`) ?? 60) : 0) }}";
const c5 = src.split(OLD_COLSPAN).length - 1;
if (c5 !== 1) { console.error('Step 5 count:', c5); process.exit(1); }
src = src.replace(OLD_COLSPAN, NEW_COLSPAN);
console.log('Step 5: colSpan updated for waybill FCs in header row 1');

// ── Step 6: Metric sub-headers (Row 2) — add Waybills th after last metric ───
const OLD_ROW2 = `                        {fcList.flatMap((fc) =>
                          activeMetrics.map((m, mi) => {
                            const colKey = \`\${fc.uuid}:\${m}\`;
                            const autoW = autoColWidthsMap.get(colKey) ?? 38;
                            const colW = getColWidth(colKey, autoW);
                            const isLast = mi === activeMetrics.length - 1;
                            return (
                              <th
                                key={\`\${fc.uuid}:\${m}\`}
                                title={METRIC_LABELS[m]}
                                className={\`relative overflow-hidden px-2 py-1 text-center text-[10px] font-medium text-gray-500 \${isLast ? 'border-r border-gray-200' : 'border-r border-gray-100'}\`}
                                style={{ width: colW, minWidth: colW }}
                              >
                                <span className="truncate block">{METRIC_LABELS[m]}</span>
                                <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, colKey, autoW)} />
                              </th>
                            );
                          })
                        )}`;

const NEW_ROW2 = `                        {fcList.flatMap((fc) => {
                          const metricThs = activeMetrics.map((m, mi) => {
                            const colKey = \`\${fc.uuid}:\${m}\`;
                            const autoW = autoColWidthsMap.get(colKey) ?? 38;
                            const colW = getColWidth(colKey, autoW);
                            const isLast = mi === activeMetrics.length - 1 && !waybillFcSet.has(fc.uuid);
                            return (
                              <th
                                key={\`\${fc.uuid}:\${m}\`}
                                title={METRIC_LABELS[m]}
                                className={\`relative overflow-hidden px-2 py-1 text-center text-[10px] font-medium text-gray-500 \${isLast ? 'border-r border-gray-200' : 'border-r border-gray-100'}\`}
                                style={{ width: colW, minWidth: colW }}
                              >
                                <span className="truncate block">{METRIC_LABELS[m]}</span>
                                <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, colKey, autoW)} />
                              </th>
                            );
                          });
                          if (waybillFcSet.has(fc.uuid)) {
                            const wKey = \`\${fc.uuid}:waybillSum\`;
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
                            );
                          }
                          return metricThs;
                        })}`;

const c6 = src.split(OLD_ROW2).length - 1;
if (c6 !== 1) { console.error('Step 6 count:', c6); process.exit(1); }
src = src.replace(OLD_ROW2, NEW_ROW2);
console.log('Step 6: Waybills th added to Row 2 metric sub-headers');

// ── Step 7: Cell rendering — add Waybills td after metric tds ────────────────
// Find the fcList.flatMap in tbody that renders metric cells
// The pattern is: fcList.flatMap((fc) => activeMetrics.map((m) => { ... getCellValue ...
// There are multiple flatMap occurrences but the tbody one renders <td> elements
const OLD_CELL = `                              {fcList.flatMap((fc) =>
                                activeMetrics.map((m) => {
                                  const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
                                  const value = cell ? getCellValue(cell, m) : 0;
                                  return (
                                    <td
                                      key={\`\${fc.uuid}:\${m}\`}`;

// Let's find an anchor we're sure about
const OLD_CELL_ANCHOR = "                              {fcList.flatMap((fc) =>\n                                activeMetrics.map((m) => {\n                                  const cell = cellMap.get(`${job.key}:${fc.uuid}`);\n                                  const value = cell ? getCellValue(cell, m) : 0;\n                                  return (\n                                    <td\n                                      key={`${fc.uuid}:${m}`}";
const c7a = src.split(OLD_CELL_ANCHOR).length - 1;
console.log('Step 7 anchor count:', c7a);

if (c7a === 1) {
  // Find the full flatMap block to replace
  const start = src.indexOf(OLD_CELL_ANCHOR);
  // Find the end of this flatMap - look for the closing pattern
  // The flatMap ends with: )}\n ... after the last </td>
  // Let's find it by finding the matching structure
  // After the inner activeMetrics.map, there's a closing )} for flatMap
  // We need to find the end of the flatMap block
  
  // Strategy: find the next occurrence of ")}" after the start that closes the fcList.flatMap
  // Actually, let's just find the specific closing pattern unique to this flatMap
  const FLATMAP_END_MARKER = "                              )}\n                            </tr>";
  const flatmapEndIdx = src.indexOf(FLATMAP_END_MARKER, start);
  if (flatmapEndIdx === -1) { console.error('Step 7: flatmap end not found'); process.exit(1); }
  
  const oldFlatmap = src.slice(start, flatmapEndIdx + FLATMAP_END_MARKER.length);
  
  // Now build the replacement: same but with waybillFcSet handling
  const newFlatmap = `                              {fcList.flatMap((fc) => {
                                const cells_tds = activeMetrics.map((m) => {
                                  const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
                                  const value = cell ? getCellValue(cell, m) : 0;
                                  return (
                                    <td
                                      key={\`\${fc.uuid}:\${m}\`}` + oldFlatmap.slice(OLD_CELL_ANCHOR.length, oldFlatmap.indexOf(FLATMAP_END_MARKER) - 0)
    .replace(/\}\)\n                              \}\)\n                            <\/tr>$/, '') // trim the end
    + `);
                                });
                                if (waybillFcSet.has(fc.uuid)) {
                                  const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
                                  cells_tds.push(
                                    <td
                                      key={\`\${fc.uuid}:waybillSum\`}
                                      className="px-2 py-1.5 text-right text-xs tabular-nums border-r border-gray-200 bg-amber-50 text-amber-800"
                                    >
                                      {cell && cell.waybillSum !== 0 ? cell.waybillSum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : ''}
                                    </td>
                                  );
                                }
                                return cells_tds;
                              })}
                            </tr>`;
  console.log('Step 7: complex replacement - trying a simpler approach instead');
}

fs.writeFileSync('components/figma/projects-report-table.tsx', src, 'utf8');
console.log('Steps 1-6 applied. Step 7 (cell td) needs separate handling.');
