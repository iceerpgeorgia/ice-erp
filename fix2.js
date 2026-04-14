const fs = require('fs');
const b = fs.readFileSync('components/financial-codes-table.tsx');
let s = b.toString('hex');
const corrupt = 'c3a2c593e2809c';
const correct = 'e29c93';
const count = s.split(corrupt).length - 1;
console.log('Corrupted checkmarks found:', count);
s = s.split(corrupt).join(correct);
let c = Buffer.from(s, 'hex').toString('utf8').replace(/\r\n/g, '\n');
const checkmark = '\u2713';
const dup1 = '          <td className="px-4 py-3 text-center">\n            {code.isBundle ? "' + checkmark + '" : ""}\n          </td>\n          <td className="px-4 py-3 text-center">\n            {code.isBundle ? "' + checkmark + '" : ""}\n          </td>';
const single1 = '          <td className="px-4 py-3 text-center">\n            {code.isBundle ? "' + checkmark + '" : ""}\n          </td>';
console.log('Contains dup:', c.includes(dup1));
if (c.includes(dup1)) { c = c.replace(dup1, single1); console.log('Fixed!'); }
const cnt = (c.match(/isBundle \? /g)||[]).length;
console.log('isBundle cells after:', cnt);
fs.writeFileSync('components/financial-codes-table.tsx', c.replace(/\n/g, '\r\n'), 'utf8');
console.log('Done');
