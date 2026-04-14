const fs = require('fs');
let c = fs.readFileSync('app/api/financial-codes/route.ts', 'utf8').replace(/\r\n/g, '\n');
const dup = '  const isBundle = typeof body?.isBundle === "boolean" ? body.isBundle : false;\n  const isBundle = typeof body?.isBundle === "boolean" ? body.isBundle : false;';
const single = '  const isBundle = typeof body?.isBundle === "boolean" ? body.isBundle : false;';
if (c.includes(dup)) { c = c.replace(dup, single); console.log('Fixed dup'); } else { console.log('not found - count:', (c.match(/const isBundle/g)||[]).length); }
fs.writeFileSync('app/api/financial-codes/route.ts', c.replace(/\n/g, '\r\n'), 'utf8');
