const fs = require('fs');
let c = fs.readFileSync('app/api/projects/[id]/route.ts', 'utf8').replace(/\r\n/g, '\n');
const from = "} catch (bundleErr) { console.warn('Bundle sync skipped (PUT):', bundleErr?.message); }";
const to = "} catch (bundleErr: any) { console.warn('Bundle sync skipped (PUT):', bundleErr?.message); }";
if (c.includes(from)) { c = c.replace(from, to); console.log('Fixed'); } else { console.log('not found'); }
fs.writeFileSync('app/api/projects/[id]/route.ts', c.replace(/\n/g, '\r\n'), 'utf8');
