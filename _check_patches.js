const fs=require('fs');
const src=fs.readFileSync('components/figma/projects-report-table.tsx','utf8');
console.log('waybillSum in MetricKey:', src.includes("'waybillSum'"));
console.log('Waybills label:', src.includes("waybillSum: 'Waybills'"));
console.log('waybillSum in CellData:', src.includes('waybillSum: number'));
