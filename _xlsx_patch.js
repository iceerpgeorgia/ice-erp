const fs = require("fs");
const path = "components/figma/projects-report-table.tsx";
let src = fs.readFileSync(path, "utf8");

const oldExport = `  const handleExport = () => {
    if (!report?.projects?.length) return;
    const wb = XLSX.utils.book_new();
    for (const proj of report.projects) {
      const fcFilter = projectFcFilters[proj.projectUuid] ?? "all";
      const { jobList, fcList, cellMap, waybillFcMap } = buildPivot(proj, fcFilter);
      const sheetName = \`\${proj.projectIndex}\`.replace(/[\\\\\\\\/:\\*?[\\]]/g, "_").slice(0, 31);
      const headerRow = ["Job", ...fcList.flatMap((fc) => activeMetrics.map((m) => \`\${fc.code} / \${METRIC_LABELS[m]}\`)), "Total"];
      const dataRows = jobList.map((job) => {
        let rowTotal = 0;
        const cols = fcList.flatMap((fc) => activeMetrics.map((m) => {
          const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
          const v = cell ? getCellValue(cell, m) : 0;
          if (!NON_ADDITIVE_METRICS.has(m)) rowTotal += v;
          return v;
        }));
        return [job.label, ...cols, rowTotal];
      });
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    XLSX.writeFile(wb, \`projects-report-\${new Date().toISOString().slice(0, 10)}.xlsx\`);
  };`;

if (!src.includes('const handleExport = () => {')) {
  console.error("FAIL: handleExport not found"); process.exit(1);
}

// Find the exact block by locating start and end
const exportStart = src.indexOf('  const handleExport = () => {');
const exportEnd = src.indexOf('\n  };\n\n  const metricOptions', exportStart);
if (exportStart === -1 || exportEnd === -1) {
  console.error("FAIL: could not locate handleExport bounds", exportStart, exportEnd); process.exit(1);
}
const oldBlock = src.slice(exportStart, exportEnd + 4); // include '  };'
console.log("Found block, length:", oldBlock.length, "first 80:", JSON.stringify(oldBlock.slice(0,80)));

const newBlock = `  const handleExport = () => {
    if (!report?.projects?.length) return;
    const wb = XLSX.utils.book_new();

    // Pre-compute pivot data for each project once
    const pivotByProject = report.projects.map((proj) => {
      const fcFilter = projectFcFilters[proj.projectUuid] ?? 'all';
      return { proj, ...buildPivot(proj, fcFilter) };
    });

    // ── Summary sheet (FCs × Projects) ──────────────────────────────────────
    const summaryMetric: MetricKey = activeMetrics.includes('payment')
      ? 'payment'
      : (activeMetrics.find((m) => !NON_ADDITIVE_METRICS.has(m)) ?? 'payment');

    // Collect all FCs that appear in any project, sorted by code
    const allFcMap = new Map<string, { uuid: string; code: string; validation: string; isIncome: boolean }>();
    for (const { fcList } of pivotByProject) {
      for (const fc of fcList) {
        if (!allFcMap.has(fc.uuid)) allFcMap.set(fc.uuid, fc);
      }
    }
    const allFcs = Array.from(allFcMap.values()).sort((a, b) => a.code.localeCompare(b.code));

    const summaryHeader = [
      'FC Code', 'FC Name', 'Income/Cost',
      ...report.projects.map((p) => \`\${p.projectIndex}\`),
    ];
    const summaryRows: (string | number)[][] = [];
    for (const fc of allFcs) {
      const projectTotals = pivotByProject.map(({ jobList, cellMap }) => {
        const total = jobList.reduce((sum, job) => {
          const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
          return sum + (cell ? getCellValue(cell, summaryMetric) : 0);
        }, 0);
        return total !== 0 ? Math.round(total * 100) / 100 : '';
      });
      if (projectTotals.some((v) => v !== '' && v !== 0)) {
        summaryRows.push([fc.code, fc.validation || fc.code, fc.isIncome ? 'Income' : 'Cost', ...projectTotals]);
      }
    }
    // Totals row in summary
    const summaryTotals: (string | number)[] = ['', 'TOTAL', '', ...pivotByProject.map(({ jobList, fcList, cellMap }) =>
      fcList.reduce((fcSum, fc) =>
        fcSum + jobList.reduce((jSum, job) => {
          const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
          return jSum + (cell && !NON_ADDITIVE_METRICS.has(summaryMetric) ? getCellValue(cell, summaryMetric) : 0);
        }, 0), 0)
    )];
    const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows, summaryTotals]);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // ── Per-project sheets ────────────────────────────────────────────────────
    for (const { proj, jobList, fcList, cellMap, waybillFcMap } of pivotByProject) {
      const rawName = \`\${proj.projectIndex} \${proj.projectName}\`.replace(/[\\\\/:*?[\\]]/g, '_');
      const sheetName = rawName.slice(0, 31);
      const headerRow = [
        'Job', 'Floors',
        ...fcList.flatMap((fc) => [
          ...activeMetrics.map((m) => \`\${fc.code} / \${METRIC_LABELS[m]}\`),
          ...(waybillFcMap.has(fc.uuid) ? [\`\${fc.code} / Waybill\`] : []),
        ]),
        'Total',
      ];
      const dataRows = jobList.map((job) => {
        let rowTotal = 0;
        const cols = fcList.flatMap((fc) => {
          const metricCols = activeMetrics.map((m) => {
            const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
            const v = cell ? getCellValue(cell, m) : 0;
            if (!NON_ADDITIVE_METRICS.has(m)) rowTotal += v;
            return v;
          });
          const waybillCols = waybillFcMap.has(fc.uuid) ? ['-'] : [];
          return [...metricCols, ...waybillCols];
        });
        return [job.label || '(No Job)', job.floors || 0, ...cols, rowTotal];
      });
      // Totals row
      const totalsRow = [
        'TOTAL', '',
        ...fcList.flatMap((fc) => {
          const metricCols = activeMetrics.map((m) => {
            if (NON_ADDITIVE_METRICS.has(m)) return '';
            return jobList.reduce((sum, job) => {
              const cell = cellMap.get(\`\${job.key}:\${fc.uuid}\`);
              return sum + (cell ? getCellValue(cell, m) : 0);
            }, 0);
          });
          const waybillCols = waybillFcMap.has(fc.uuid) ? [proj.waybillSum > 0 ? Math.round(proj.waybillSum * 100) / 100 : '-'] : [];
          return [...metricCols, ...waybillCols];
        }),
        '',
      ];
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows, totalsRow]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, \`projects-report-\${new Date().toISOString().slice(0, 10)}.xlsx\`);
  };`;

src = src.slice(0, exportStart) + newBlock + src.slice(exportEnd + 4);
fs.writeFileSync(path, src, "utf8");
console.log("patched OK");
