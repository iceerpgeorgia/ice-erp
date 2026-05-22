const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Find the totals row flatMap
const TOTALS_START = 'fcList.flatMap((fc) =>\n                          activeMetrics.map((m, mi) => {\n                            const colKey = `${fc.uuid}:${m}`;\n                            const colW = getColWidth(colKey, autoColWidthsMap.get(colKey) ?? 38);\n                            const isLast = mi === activeMetrics.length - 1;\n                            const colTotal = NON_ADDITIVE_METRICS.has(m) ? 0 : jobList.reduce((sum, job) => {\n                              const cell = cellMap.get(`${job.key}:${fc.uuid}`);\n                              return sum + (cell ? getCellValue(cell, m) : 0);\n                            }, 0)';

const idx = src.indexOf(TOTALS_START);
if (idx === -1) { console.error('TOTALS_START not found'); process.exit(1); }

// Find the end: "          })\n                        )}"
const TOTALS_END = '                          })\n                        )}';
const endIdx = src.indexOf(TOTALS_END, idx);
if (endIdx === -1) { console.error('TOTALS_END not found'); process.exit(1); }

const blockEnd = endIdx + TOTALS_END.length;
const oldBlock = src.slice(idx, blockEnd);
console.log('Totals block length:', oldBlock.length);
console.log('First 80:', JSON.stringify(oldBlock.slice(0, 80)));
console.log('Last 80:', JSON.stringify(oldBlock.slice(-80)));

const newBlock = `fcList.flatMap((fc) => {
                          const totMetricTds = activeMetrics.map((m, mi) => {
                            const colKey = \`\${fc.uuid}:\${m}\`;
                            const colW = getColWidth(colKey, autoColWidthsMap.get(colKey) ?? 38);
                            const isLast = mi === activeMetrics.length - 1 && !waybillFcSet.has(fc.uuid);
                            const colTotal = NON_ADDITIVE_METRICS.has(m) ? 0 : jobList.reduce((sum, job) => {
                              const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
                              return sum + (cell ? getCellValue(cell, m) : 0);
                            }, 0);
                            return (
                              <td
                                key={\`\${fc.uuid}:\${m}\`}
                                className={\`px-3 py-2 text-right tabular-nums \${isLast ? 'border-r border-gray-200' : 'border-r border-gray-100'}\`}
                                style={{ width: colW, maxWidth: colW }}
                              >
                                {NON_ADDITIVE_METRICS.has(m)
                                  ? <span className="text-gray-300">—</span>
                                  : <span className={colTotal !== 0 ? 'text-gray-800' : 'text-gray-400'}>{formatCell(colTotal, m)}</span>
                                }
                              </td>
                            );
                          });
                          if (waybillFcSet.has(fc.uuid)) {
                            const waybillTotal = jobList.reduce((sum, job) => {
                              const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
                              return sum + (cell?.waybillSum ?? 0);
                            }, 0);
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
                          return totMetricTds;
                        })}`;

src = src.slice(0, idx) + newBlock + src.slice(blockEnd);

fs.writeFileSync('components/figma/projects-report-table.tsx', src, 'utf8');
console.log('Step 8: totals row flatMap updated with waybill total td');
