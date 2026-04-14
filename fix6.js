const fs = require('fs');
let c = fs.readFileSync('app/api/projects/route.ts', 'utf8').replace(/\r\n/g, '\n');
c = c.split("} catch (bundleErr) {").join("} catch (bundleErr: any) {");
fs.writeFileSync('app/api/projects/route.ts', c.replace(/\n/g, '\r\n'), 'utf8');
console.log('Done');
