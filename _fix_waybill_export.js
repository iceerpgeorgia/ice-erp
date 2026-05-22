const fs = require('fs');
const f = 'components/figma/projects-report-table.tsx';
let s = fs.readFileSync(f, 'utf8');

function rep(old, nw, label) {
  if (!s.includes(old)) { console.error('MISS:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK:', label);
}

const CRLF = '\r\n';

// ── Fix 1: relax hasWaybill condition in export ──────────────────────────────
rep(
  'const hasWaybill = proj.waybillSum > 0 && !!proj.waybillPairedFcCode;',
  'const hasWaybill = proj.waybillSum > 0;',
  'relax hasWaybill condition'
);

// ── Fix 2: use fallback label when waybillPairedFcCode is null ───────────────
rep(
  'setC(ws, 0, waybillCol, proj.waybillPairedFcCode!, S.H1);',
  "setC(ws, 0, waybillCol, proj.waybillPairedFcCode ?? 'Waybill', S.H1);",
  'waybill header fallback label'
);

// ── Fix 3: add waybill row to Summary sheet (before TOTAL row) ───────────────
// Find the block that writes the TOTAL row in the summary sheet
const OLD_SUM_TOTAL =
  "    setC(sumWs, sumRow, 0, '', S.TL);" + CRLF +
  "    setC(sumWs, sumRow, 1, 'TOTAL', S.TL);" + CRLF +
  "    setC(sumWs, sumRow, 2, '', S.TL);" + CRLF +
  "    pivotByProject.forEach(({ jobList, fcList, cellMap }, i) => {" + CRLF +
  "      const t = fcList.reduce((s, fc) => s + jobList.reduce((js, job) => {" + CRLF +
  "        const cell = cellMap.get(`${job.key}:${fc.uuid}`);" + CRLF +
  "        return js + (cell && !NON_ADDITIVE_METRICS.has(summaryMetric) ? getCellValue(cell, summaryMetric) : 0);" + CRLF +
  "      }, 0), 0);" + CRLF +
  "      setC(sumWs, sumRow, 3 + i, Math.round(t * 100) / 100, t !== 0 ? S.T : S.TL);" + CRLF +
  "    });" + CRLF +
  "    sumWs['!ref'] = `A1:${cellAddr(sumRow, 2 + report.projects.length)}`;";

const NEW_SUM_TOTAL =
  "    // Waybill row in summary" + CRLF +
  "    const waybillTots = pivotByProject.map(({ proj: p }) => p.waybillSum > 0 ? Math.round(p.waybillSum * 100) / 100 : 0);" + CRLF +
  "    if (waybillTots.some((v) => v > 0)) {" + CRLF +
  "      const anyWb = pivotByProject.find(({ proj: p }) => p.waybillSum > 0);" + CRLF +
  "      const wbCode = anyWb?.proj.waybillPairedFcCode ?? 'Waybill';" + CRLF +
  "      const wbName = anyWb?.proj.waybillPairedFcValidation ?? wbCode;" + CRLF +
  "      setC(sumWs, sumRow, 0, wbCode, { ...S.D, alignment: { horizontal: 'left' } });" + CRLF +
  "      setC(sumWs, sumRow, 1, wbName, { ...S.D, alignment: { horizontal: 'left' } });" + CRLF +
  "      setC(sumWs, sumRow, 2, 'Cost', { ...S.D, alignment: { horizontal: 'center' } });" + CRLF +
  "      waybillTots.forEach((v, c) => setC(sumWs, sumRow, 3 + c, v, v > 0 ? S.D : S.D0));" + CRLF +
  "      sumRow++;" + CRLF +
  "    }" + CRLF +
  CRLF +
  "    setC(sumWs, sumRow, 0, '', S.TL);" + CRLF +
  "    setC(sumWs, sumRow, 1, 'TOTAL', S.TL);" + CRLF +
  "    setC(sumWs, sumRow, 2, '', S.TL);" + CRLF +
  "    pivotByProject.forEach(({ proj: p, jobList, fcList, cellMap }, i) => {" + CRLF +
  "      const fcTot = fcList.reduce((s, fc) => s + jobList.reduce((js, job) => {" + CRLF +
  "        const cell = cellMap.get(`${job.key}:${fc.uuid}`);" + CRLF +
  "        return js + (cell && !NON_ADDITIVE_METRICS.has(summaryMetric) ? getCellValue(cell, summaryMetric) : 0);" + CRLF +
  "      }, 0), 0);" + CRLF +
  "      const wbTot = summaryMetric === 'payment' ? (p.waybillSum > 0 ? Math.round(p.waybillSum * 100) / 100 : 0) : 0;" + CRLF +
  "      const t = Math.round((fcTot + wbTot) * 100) / 100;" + CRLF +
  "      setC(sumWs, sumRow, 3 + i, t, t !== 0 ? S.T : S.TL);" + CRLF +
  "    });" + CRLF +
  "    sumWs['!ref'] = `A1:${cellAddr(sumRow, 2 + report.projects.length)}`;";

rep(OLD_SUM_TOTAL, NEW_SUM_TOTAL, 'add waybill row to summary + update totals');

fs.writeFileSync(f, s, 'utf8');
console.log('Done — 3 fixes applied.');
