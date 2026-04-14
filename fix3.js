const fs = require('fs');
let c = fs.readFileSync('app/api/financial-codes/route.ts', 'utf8').replace(/\r\n/g, '\n');
const from1 = "  const automatedPaymentId = typeof body?.automatedPaymentId === \"boolean\" ? body.automatedPaymentId : false;";
const to1 = "  const automatedPaymentId = typeof body?.automatedPaymentId === \"boolean\" ? body.automatedPaymentId : false;\n  const isBundle = typeof body?.isBundle === \"boolean\" ? body.isBundle : false;";
const from2 = "      automatedPaymentId,\n      parentUuid,\n    },\n  } as const;";
const to2 = "      automatedPaymentId,\n      isBundle,\n      parentUuid,\n    },\n  } as const;";
if (c.includes(from1)) { c = c.replace(from1, to1); console.log('Added isBundle extraction'); } else { console.log('NOT FOUND 1'); console.log(c.substring(c.indexOf('automatedPaymentId = typeof'), 200)); }
if (c.includes(from2)) { c = c.replace(from2, to2); console.log('Added isBundle to payload'); } else { console.log('NOT FOUND 2'); }
fs.writeFileSync('app/api/financial-codes/route.ts', c.replace(/\n/g, '\r\n'), 'utf8');
console.log('Done');
