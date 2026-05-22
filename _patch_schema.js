const fs = require('fs');
let src = fs.readFileSync('prisma/schema.prisma', 'utf8').replace(/\r\n/g, '\n');
const OLD = '  is_active             Boolean        @default(true)\n  automated_payment_id  Boolean        @default(false)\n  is_bundle             Boolean        @default(false)\n  created_at            DateTime       @default(now())';
const NEW = '  is_active             Boolean        @default(true)\n  automated_payment_id  Boolean        @default(false)\n  is_bundle             Boolean        @default(false)\n  default_code_fc       String?        @db.Uuid\n  created_at            DateTime       @default(now())';
const c = src.split(OLD).length - 1;
if (c !== 1) { console.error('count:', c); process.exit(1); }
src = src.replace(OLD, NEW);
fs.writeFileSync('prisma/schema.prisma', src, 'utf8');
console.log('done');
