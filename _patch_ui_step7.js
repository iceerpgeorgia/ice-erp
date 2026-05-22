const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Find the exact start of the flatMap block in the tbody
const FLAT_START = 'fcList.flatMap((fc) =>\n                              activeMetrics.map((m, mi) => {\n                                const colKey = `${fc.uuid}:${m}`;\n                                const colW = getColWidth(colKey, autoColWidthsMap.get(colKey) ?? 38);\n                                const isLast = mi === activeMetrics.length - 1;\n                                const cell = cellMap.get(`${job.key}:${fc.uuid}`);';

const idx = src.indexOf(FLAT_START);
if (idx === -1) { console.error('FLAT_START not found'); process.exit(1); }

// Find the end: the closing ")}" for the flatMap
// After the inner map closing "  })" there's the flatMap closing ")"  
// Signature: "                              })\n                            )}"
const FLAT_END = '                              })\n                            )}';
const endIdx = src.indexOf(FLAT_END, idx);
if (endIdx === -1) { console.error('FLAT_END not found'); process.exit(1); }

const blockEnd = endIdx + FLAT_END.length;

// Extract old block for verification
const oldBlock = src.slice(idx, blockEnd);
console.log('Old block length:', oldBlock.length);
console.log('Old block first 100:', JSON.stringify(oldBlock.slice(0, 100)));
console.log('Old block last 100:', JSON.stringify(oldBlock.slice(-100)));

// Construct the new block
const newBlock = `fcList.flatMap((fc) => {
                              const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
                              const metricTds = activeMetrics.map((m, mi) => {
                                const colKey = \`\${fc.uuid}:\${m}\`;
                                const colW = getColWidth(colKey, autoColWidthsMap.get(colKey) ?? 38);
                                const isLast = mi === activeMetrics.length - 1 && !waybillFcSet.has(fc.uuid);
                                const value = cell ? getCellValue(cell, m) : 0;
                                return (
                                  <td
                                    key={\`\${fc.uuid}:\${m}\`}
                                    className={\`relative px-3 py-2 text-right tabular-nums overflow-hidden \${isLast ? 'border-r border-gray-200' : 'border-r border-gray-100'}\`}
                                    style={{ width: colW, maxWidth: colW }}
                                    title={cell?.paymentIds?.join(', ') || undefined}
                                  >
                                    {mi === 0 && (
                                      <button
                                        type="button"
                                        className="absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 hover:bg-blue-100 text-blue-400 hover:text-blue-600 rounded-sm w-4 h-4 flex items-center justify-center text-[11px] leading-none transition-opacity z-10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCellAddLedger({
                                            projectUuid: proj.projectUuid,
                                            projectLabel: \`\${proj.projectIndex} – \${proj.projectName}\`,
                                            financialCodeUuid: fc.uuid,
                                            financialCodeLabel: fc.validation || fc.code,
                                            jobUuid: isNoJob ? null : job.key,
                                            jobLabel: isNoJob ? null : job.label,
                                          });
                                        }}
                                        title="Add ledger entry for this project / FC / job"
                                      >
                                        +
                                      </button>
                                    )}
                                    {value !== 0 ? <span className="text-gray-800">{formatCell(value, m)}</span> : <span className="text-gray-200">—</span>}
                                  </td>
                                );
                              });
                              if (waybillFcSet.has(fc.uuid)) {
                                metricTds.push(
                                  <td
                                    key={\`\${fc.uuid}:waybillSum\`}
                                    className="px-3 py-2 text-right tabular-nums border-r border-gray-200 bg-amber-50 text-amber-800"
                                  >
                                    {cell && cell.waybillSum !== 0 ? formatMoney(cell.waybillSum) : <span className="text-gray-200">—</span>}
                                  </td>
                                );
                              }
                              return metricTds;
                            })}`;

src = src.slice(0, idx) + newBlock + src.slice(blockEnd);

fs.writeFileSync('components/figma/projects-report-table.tsx', src, 'utf8');
console.log('Step 7: cell flatMap updated with waybill td');
