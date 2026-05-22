const fs = require('fs');

function fix(filePath, patches) {
  let s = fs.readFileSync(filePath, 'utf8');
  const isCRLF = s.includes('\r\n');
  for (const [oldLF, newLF, label] of patches) {
    const old = isCRLF ? oldLF.replace(/\n/g, '\r\n') : oldLF;
    const nw  = isCRLF ? newLF.replace(/\n/g, '\r\n') : newLF;
    if (!s.includes(old)) { console.error('MISS:', label, 'in', filePath); process.exit(1); }
    s = s.replace(old, nw);
    console.log('OK:', label);
  }
  fs.writeFileSync(filePath, s, 'utf8');
}

// ── payments-ledger/route.ts ──────────────────────────────────────────────────
fix('app/api/payments-ledger/route.ts', [
  [
    `    // Accrual is required; order is optional\n    if (!accrual || accrual === 0) {\n      return NextResponse.json(\n        { error: 'Accrual is required and cannot be zero' },\n        { status: 400 }\n      );\n    }`,
    `    // At least one of accrual or order must be provided\n    if ((!accrual || accrual === 0) && (!order || order === 0)) {\n      return NextResponse.json(\n        { error: 'Either Accrual or Order must be provided and cannot be zero' },\n        { status: 400 }\n      );\n    }`,
    'single route: relax accrual-required'
  ],
  [
    `    const existingAccrual = Number(totals?.[0]?.accrual_total ?? 0);\n    const existingOrder = Number(totals?.[0]?.order_total ?? 0);\n    const newOrder = Number(order || 0);\n    const newAccrual = Number(accrual || 0);\n    const toCents = (value: number) => Math.round(value * 100);\n    const currentExcessCents = Math.max(0, toCents(existingOrder) - toCents(existingAccrual));\n    const nextExcessCents = Math.max(\n      0,\n      toCents(existingOrder + newOrder) - toCents(existingAccrual + newAccrual)\n    );\n\n    if (nextExcessCents > currentExcessCents) {\n      return NextResponse.json(\n        { error: 'Total order cannot exceed total accrual for this payment' },\n        { status: 400 }\n      );\n    }`,
    `    // Totals loaded for reference (accrual and order are independent)`,
    'single route: remove order-exceeds-accrual'
  ],
]);

// ── payments-ledger/bulk/route.ts ─────────────────────────────────────────────
fix('app/api/payments-ledger/bulk/route.ts', [
  [
    `      if (!entry.accrual || entry.accrual === 0) {\n        logs.push(\`[ERROR] Accrual missing (payment \${entry.paymentId})\`);\n        return NextResponse.json(\n          {\n            error: \`Accrual is required and cannot be zero (payment \${entry.paymentId})\`,\n            logs: logs.join('\\n'),\n          },\n          { status: 400 }\n        );\n      }`,
    `      if ((!entry.accrual || entry.accrual === 0) && (!entry.order || entry.order === 0)) {\n        logs.push(\`[ERROR] Accrual or Order missing (payment \${entry.paymentId})\`);\n        return NextResponse.json(\n          {\n            error: \`Either Accrual or Order must be provided (payment \${entry.paymentId})\`,\n            logs: logs.join('\\n'),\n          },\n          { status: 400 }\n        );\n      }`,
    'bulk route: relax accrual-required'
  ],
  [
    `    for (const [paymentId, addedOrder] of orderAdditions.entries()) {\n      const existing = totalsMap.get(paymentId) || { accrual: 0, order: 0 };\n      const toCents = (value: number) => Math.round(value * 100);\n      const currentExcessCents = Math.max(0, toCents(existing.order) - toCents(existing.accrual));\n      const nextExcessCents = Math.max(\n        0,\n        (toCents(existing.order) + toCents(addedOrder)) -\n          (toCents(existing.accrual) + toCents(accrualAdditions.get(paymentId) || 0))\n      );\n\n      if (nextExcessCents > currentExcessCents) {\n        logs.push(\`[ERROR] Order exceeds accrual for payment \${paymentId}\`);\n        return NextResponse.json(\n          {\n            error: \`Total order cannot exceed total accrual for payment \${paymentId}\`,\n            logs: logs.join('\\n'),\n          },\n          { status: 400 }\n        );\n      }\n    }\n    logs.push('[INFO] Totals consistency check passed');`,
    `    logs.push('[INFO] Totals consistency check skipped (accrual and order are independent)');`,
    'bulk route: remove order-exceeds-accrual'
  ],
]);

console.log('All done.');
