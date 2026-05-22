const fs = require('fs');

let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8');

const OLD = `    // Compute which FCs have waybill data
    // Map: income FC uuid → paired cost FC code (for waybill column label)
    const waybillFcMap = new Map<string, string>();
    for (const fc of fcList) {
      const cell = [...cellMap.values()].find((c) => c.financialCodeUuid === fc.uuid && c.waybillSum > 0);
      if (cell?.pairedFcCode) waybillFcMap.set(fc.uuid, cell.pairedFcCode);
    }`;

const NEW = `    // Build waybillFcMap directly from proj.cells (more reliable than iterating cellMap)
    // Maps income FC uuid → paired cost FC code label (e.g. '2.1.1.6')
    const waybillFcMap = new Map<string, string>();
    for (const cell of proj.cells) {
      if (cell.waybillSum > 0 && cell.pairedFcCode) {
        waybillFcMap.set(cell.financialCodeUuid, cell.pairedFcCode);
      }
    }`;

if (!src.includes(OLD)) {
  console.error('OLD string not found!');
  process.exit(1);
}

const updated = src.replace(OLD, NEW);
fs.writeFileSync('components/figma/projects-report-table.tsx', updated);
console.log('Patched successfully.');
