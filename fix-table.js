const fs = require('fs');
let content = fs.readFileSync('components/figma/payments-report-table.tsx', 'utf8');
// Add to type
if (!content.includes('isBundlePayment')) {
  content = content.replace(
    '  isProjectDerived?: boolean;\n  counteragent: string;',
    '  isProjectDerived?: boolean;\n  isBundlePayment?: boolean;\n  counteragent: string;'
  );
  // Add to columns array
  content = content.replace(
      { key: 'isProjectDerived', label: 'Auto', visible: true, sortable: true, filterable: true, format: 'boolean', width: 90 },\n  { key: 'latestDate', label: 'Latest Date', visible: true, sortable: true, filterable: true, format: 'date', width: 120 },,
      { key: 'isProjectDerived', label: 'Auto', visible: true, sortable: true, filterable: true, format: 'boolean', width: 90 },\n  { key: 'isBundlePayment', label: 'Bundle', visible: true, sortable: true, filterable: true, format: 'boolean', width: 90 },\n  { key: 'latestDate', label: 'Latest Date', visible: true, sortable: true, filterable: true, format: 'date', width: 120 },
  );
  fs.writeFileSync('components/figma/payments-report-table.tsx', content, 'utf8');
  console.log('Updated payments-report-table.tsx');
} else {
  console.log('File already has isBundlePayment');
}
