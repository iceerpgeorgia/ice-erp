const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// 1. Add 'waybillSum' to MetricKey union type
const MK_OLD = "type MetricKey = 'accrual' | 'latestAccrual' | 'order' | 'lastMonthAccrual' | 'lastMonthOrder' | 'payment' | 'due' | 'balance' | 'paymentCount' | 'accrualPerFloor';";
const MK_NEW = "type MetricKey = 'accrual' | 'latestAccrual' | 'order' | 'lastMonthAccrual' | 'lastMonthOrder' | 'payment' | 'due' | 'balance' | 'paymentCount' | 'accrualPerFloor' | 'waybillSum';";
const c1 = src.split(MK_OLD).length - 1;
if (c1 !== 1) { console.error('Step 1 count:', c1); process.exit(1); }
src = src.replace(MK_OLD, MK_NEW);

// 2. Add label for waybillSum
const LABELS_OLD = "  accrualPerFloor: 'Accrual/Floor',\n};";
const LABELS_NEW = "  accrualPerFloor: 'Accrual/Floor',\n  waybillSum: 'Waybills',\n};";
const c2 = src.split(LABELS_OLD).length - 1;
if (c2 !== 1) { console.error('Step 2 count:', c2); process.exit(1); }
src = src.replace(LABELS_OLD, LABELS_NEW);

// 3. Add waybillSum to CellData type (after pensionOnTax)
const CD_OLD = "  pensionOnTax: boolean;\n};";
const CD_NEW = "  pensionOnTax: boolean;\n  waybillSum: number;\n};";
const c3 = src.split(CD_OLD).length - 1;
if (c3 !== 1) { console.error('Step 3 count:', c3); process.exit(1); }
src = src.replace(CD_OLD, CD_NEW);

// 4. Add waybillSum to the effectiveValue function (it's not taxable, just pass through)
// Find the function and add waybillSum case - it's not in MetricKey switching logic, just returned as-is
// The effectiveValue function should return cell.waybillSum for 'waybillSum'
// Let's find the getCellValue / effectiveValue area
const EFF_OLD = "  const effectiveValue = (cell: CellData, metric: MetricKey): number => {";
const c4 = src.split(EFF_OLD).length - 1;
if (c4 !== 1) { console.error('Step 4 search count:', c4); process.exit(1); }
// We need to look at the function body. Let's find it and add waybillSum case.
// Find the return statement in effectiveValue that handles numeric fields
// The function likely has a switch/if for tax multiplier on specific fields.
// waybillSum should just return cell.waybillSum directly (no tax gross-up).

// Search for the switch/if pattern in effectiveValue to add our case
const EFF_RETURN_OLD = "    return cell[metric] as number;";
const c4b = src.split(EFF_RETURN_OLD).length - 1;
console.log('effectiveValue return count:', c4b);

fs.writeFileSync('components/figma/projects-report-table.tsx', src, 'utf8');
console.log('Steps 1-3 done');
