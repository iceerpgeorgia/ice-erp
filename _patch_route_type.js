const fs = require('fs');
let src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

const OLD_TYPE = '        waybillSum: number;\n      }[];\n    }>();';
const NEW_TYPE = `        waybillSum: number;
        pairedFcCode: string | null;
        pairedFcValidation: string | null;
      }[];
    }>();`;

const c = src.split(OLD_TYPE).length - 1;
if (c !== 1) { console.error('count:', c); process.exit(1); }
src = src.replace(OLD_TYPE, NEW_TYPE);
console.log('Type updated in route.ts');

fs.writeFileSync('app/api/projects-report/route.ts', src, 'utf8');
