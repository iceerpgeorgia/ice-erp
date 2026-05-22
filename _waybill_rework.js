const fs = require("fs");
const f = "components/figma/projects-report-table.tsx";
let s = fs.readFileSync(f, "utf8");
let changed = 0;

function rep(old, nw, label) {
  if (!s.includes(old)) { console.error("MISS:", label); process.exit(1); }
  s = s.replace(old, nw);
  changed++;
  console.log("OK:", label);
}
function repAll(old, nw, label) {
  const count = s.split(old).length - 1;
  if (count === 0) { console.error("MISS:", label); process.exit(1); }
  s = s.replaceAll(old, nw);
  changed++;
  console.log("OK:", label, "(x"+count+")");
}

// 1. Remove globalFcMap waybill extension loop
rep(
  "    // Also ensure cost FCs from waybill data are in the map (so col appears even with no direct payments)\n    for (const proj of report.projects) {\n      if (proj.waybillPairedFcUuid && proj.waybillPairedFcCode && !map.has(proj.waybillPairedFcUuid)) {\n        map.set(proj.waybillPairedFcUuid, { uuid: proj.waybillPairedFcUuid, validation: proj.waybillPairedFcValidation ?? proj.waybillPairedFcCode, code: proj.waybillPairedFcCode, isIncome: false });\n      }\n    }\n    return map;",
  "    return map;",
  "globalFcMap waybill extension"
);

// 2. Remove waybillFcMap block from buildPivot + simplify return
rep(
  "    // waybillFcMap: key = cost FC UUID (financial_codes.default_code_fc), value = column label.\n    // The amber sub-column appears inside the cost FC column (e.g. 2.1.1.6).\n    const waybillFcMap = new Map();\n    if (proj.waybillSum > 0 && proj.waybillPairedFcUuid) {\n      waybillFcMap.set(proj.waybillPairedFcUuid, \"Waybill\");\n    }\n        return { jobList, fcList, cellMap, waybillFcMap };",
  "    return { jobList, fcList, cellMap };",
  "buildPivot waybillFcMap removed"
);

// 3. Update all destructuring of buildPivot (render + export for-of)
repAll(
  "{ jobList, fcList, cellMap, waybillFcMap } = buildPivot(",
  "{ jobList, fcList, cellMap } = buildPivot(",
  "buildPivot destructuring render"
);
rep(
  "for (const { proj, jobList, fcList, cellMap, waybillFcMap } of pivotByProject) {",
  "for (const { proj, jobList, fcList, cellMap } of pivotByProject) {",
  "export for-of destructuring"
);

// 4. thead row 1: remove waybillFcMap from colSpan
rep(
  "colSpan={activeMetrics.length + (waybillFcMap.has(fc.uuid) ? 1 : 0)}",
  "colSpan={activeMetrics.length}",
  "colSpan fix"
);

// 5. thead row 1: remove waybillFcMap from minWidth
rep(
  "style={{ minWidth: activeMetrics.reduce((s, m) => s + getColWidth(`${fc.uuid}:${m}`, autoColWidthsMap.get(`${fc.uuid}:${m}`) ?? 38), 0) + (waybillFcMap.has(fc.uuid) ? getColWidth(`${fc.uuid}:waybillSum`, autoColWidthsMap.get(`${fc.uuid}:waybillSum`) ?? 60) : 0) }}",
  "style={{ minWidth: activeMetrics.reduce((s, m) => s + getColWidth(`${fc.uuid}:${m}`, autoColWidthsMap.get(`${fc.uuid}:${m}`) ?? 38), 0) }}",
  "minWidth fix"
);

// 6. Add standalone waybill <th rowSpan=2> before Total th in row 1
rep(
  "                        <th\n                          className=\"bg-gray-100 border-l border-gray-200 relative overflow-hidden\"\n                          style={{ width: totalColW, minWidth: totalColW }}\n                          rowSpan={2}\n                        >\n                          <div className=\"px-3 py-2 text-right font-semibold text-gray-700 text-xs\">Total</div>",
  "                        {proj.waybillSum > 0 && proj.waybillPairedFcCode && (\n                          <th\n                            className=\"bg-amber-50 border-r border-amber-200 relative overflow-hidden\"\n                            style={{ width: 80, minWidth: 80 }}\n                            rowSpan={2}\n                          >\n                            <div className=\"px-2 py-1.5 text-center font-semibold text-amber-700 text-xs leading-tight\">\n                              <div>{proj.waybillPairedFcCode}</div>\n                              <div className=\"text-[9px] font-normal text-amber-500\">Waybill</div>\n                            </div>\n                          </th>\n                        )}\n                        <th\n                          className=\"bg-gray-100 border-l border-gray-200 relative overflow-hidden\"\n                          style={{ width: totalColW, minWidth: totalColW }}\n                          rowSpan={2}\n                        >\n                          <div className=\"px-3 py-2 text-right font-semibold text-gray-700 text-xs\">Total</div>",
  "waybill standalone th added"
);

// 7. Fix all 3 isLast references (row2, body, totals)
repAll(
  "const isLast = mi === activeMetrics.length - 1 && !waybillFcMap.has(fc.uuid);",
  "const isLast = mi === activeMetrics.length - 1;",
  "isLast fix"
);

// 8. Remove amber sub-header th from thead row 2
rep(
  "                          if (waybillFcMap.has(fc.uuid)) {\n                            const wKey = `${fc.uuid}:waybillSum`;\n                            const wAutoW = autoColWidthsMap.get(wKey) ?? 60;\n                            const wColW = getColWidth(wKey, wAutoW);\n                            const pairedCode = waybillFcMap.get(fc.uuid) ?? 'Waybills';\n                            metricThs.push(\n                              <th\n                                key={wKey}\n                                title={pairedCode}\n                                className=\"relative overflow-hidden px-2 py-1 text-center text-[10px] font-medium text-amber-700 border-r border-gray-200 bg-amber-50\"\n                                style={{ width: wColW, minWidth: wColW }}\n                              >\n                                <span className=\"truncate block\">{pairedCode}</span>\n                                <div className=\"absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60\" onMouseDown={(e) => startResize(e, wKey, wAutoW)} />\n                              </th>\n                            );\n                          }",
  "",
  "thead row2 waybill sub-header removed"
);

// 9. Remove amber dash td from body rows
rep(
  "                              if (waybillFcMap.has(fc.uuid)) {\n                                const wKey = `${fc.uuid}:waybillSum`;\n                                const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);\n                                metricTds.push(\n                                  <td\n                                    key={`${job.key}:${fc.uuid}:waybillSum`}\n                                    className=\"px-2 py-1 text-right text-[11px] text-amber-600 bg-amber-50 border-r border-amber-200\"\n                                    style={{ width: wColW, minWidth: wColW }}\n                                  >\n                                    {/* Waybill is project-level; shown in totals row only */}\n                                    <span className=\"text-gray-300\">-</span>\n                                  </td>\n                                );\n                              }",
  "",
  "body row waybill dash td removed"
);

// 10. Add waybill dash td in body rows after fcList.flatMap, before </tr>
rep(
  "                            })}\n                          </tr>\n                        );\n                      })}",
  "                            })}\n                            {proj.waybillSum > 0 && proj.waybillPairedFcCode && (\n                              <td className=\"px-2 py-2 text-center text-amber-200 bg-amber-50 border-r border-amber-100\" style={{ width: 80, minWidth: 80 }}>—</td>\n                            )}\n                          </tr>\n                        );\n                      })}",
  "body row waybill dash td added"
);

// 11. Remove amber total td from totals row
rep(
  "                          if (waybillFcMap.has(fc.uuid)) {\n                            // Waybill total comes from project-level aggregate (not summed per-job)\n                            const waybillTotal = proj.waybillSum;\n                            const wKey = `${fc.uuid}:waybillSum`;\n                            const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);\n                            totMetricTds.push(\n                              <td\n                                key={`${fc.uuid}:waybillSum:total`}\n                                className=\"px-2 py-1 text-right text-[11px] font-semibold text-amber-700 bg-amber-100 border-r border-amber-200\"\n                                style={{ width: wColW, minWidth: wColW }}\n                              >\n                                {waybillTotal > 0 ? formatMoney(waybillTotal) : '-'}\n                              </td>\n                            );\n                          }",
  "",
  "totals row waybill td removed"
);

// 12. Add waybill total td in totals row after fcList.flatMap, before big Total td
rep(
  "                        })}\n                        <td\n                          className=\"px-3 py-2 text-right bg-gray-200 tabular-nums text-gray-900 border-l border-gray-200\"",
  "                        })}\n                        {proj.waybillSum > 0 && proj.waybillPairedFcCode && (\n                          <td className=\"px-2 py-2 text-right text-[11px] font-semibold text-amber-700 bg-amber-100 border-r border-amber-200\" style={{ width: 80, minWidth: 80 }}>\n                            {formatMoney(proj.waybillSum)}\n                          </td>\n                        )}\n                        <td\n                          className=\"px-3 py-2 text-right bg-gray-200 tabular-nums text-gray-900 border-l border-gray-200\"",
  "totals row waybill td added"
);

// 13. Fix export per-project: remove waybillFcMap from header building
rep(
  "        ...fcList.flatMap((fc) => [\n          ...activeMetrics.map((m) => `${fc.code} / ${METRIC_LABELS[m]}`),\n          ...(waybillFcMap.has(fc.uuid) ? [`${fc.code} / Waybill`] : []),\n        ]),\n        'Total',",
  "        ...fcList.flatMap((fc) => activeMetrics.map((m) => `${fc.code} / ${METRIC_LABELS[m]}`)),\n        ...(proj.waybillSum > 0 && proj.waybillPairedFcCode ? [`${proj.waybillPairedFcCode} / Waybill`] : []),\n        'Total',",
  "export header waybill fix"
);

// 14. Fix export per-project: remove waybillFcMap from data rows
rep(
  "          const metricCols = activeMetrics.map((m) => {\n            const cell = cellMap.get(`${job.key}:${fc.uuid}`);\n            const v = cell ? getCellValue(cell, m) : 0;\n            if (!NON_ADDITIVE_METRICS.has(m)) rowTotal += v;\n            return v;\n          });\n          const waybillCols = waybillFcMap.has(fc.uuid) ? ['-'] : [];\n          return [...metricCols, ...waybillCols];",
  "          return activeMetrics.map((m) => {\n            const cell = cellMap.get(`${job.key}:${fc.uuid}`);\n            const v = cell ? getCellValue(cell, m) : 0;\n            if (!NON_ADDITIVE_METRICS.has(m)) rowTotal += v;\n            return v;\n          });",
  "export data rows waybill fix"
);
rep(
  "        return [job.label || '(No Job)', job.floors || 0, ...cols, rowTotal];",
  "        const waybillDash = proj.waybillSum > 0 && proj.waybillPairedFcCode ? ['-'] : [];\n        return [job.label || '(No Job)', job.floors || 0, ...cols, ...waybillDash, rowTotal];",
  "export data rows waybill dash"
);

// 15. Fix export per-project: remove waybillFcMap from totals row
rep(
  "          const metricCols = activeMetrics.map((m) => {\n            if (NON_ADDITIVE_METRICS.has(m)) return '';\n            return jobList.reduce((sum, job) => {\n              const cell = cellMap.get(`${job.key}:${fc.uuid}`);\n              return sum + (cell ? getCellValue(cell, m) : 0);\n            }, 0);\n          });\n          const waybillCols = waybillFcMap.has(fc.uuid) ? [proj.waybillSum > 0 ? Math.round(proj.waybillSum * 100) / 100 : '-'] : [];\n          return [...metricCols, ...waybillCols];",
  "          return activeMetrics.map((m) => {\n            if (NON_ADDITIVE_METRICS.has(m)) return '';\n            return jobList.reduce((sum, job) => {\n              const cell = cellMap.get(`${job.key}:${fc.uuid}`);\n              return sum + (cell ? getCellValue(cell, m) : 0);\n            }, 0);\n          });",
  "export totals waybill fix"
);
rep(
  "        '',\n      ];\n      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows, totalsRow]);",
  "        ...(proj.waybillSum > 0 && proj.waybillPairedFcCode ? [Math.round(proj.waybillSum * 100) / 100] : []),\n        '',\n      ];\n      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows, totalsRow]);",
  "export totals waybill value"
);

fs.writeFileSync(f, s, "utf8");
console.log("\nAll", changed, "changes applied.");
