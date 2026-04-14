const fs = require('fs');
const path = 'c:\\next-postgres-starter\\vercel.json';
let content = fs.readFileSync(path, 'utf8');

// Remove prisma migrate deploy from buildCommand
content = content.replace(
  '"pnpm prisma generate && pnpm prisma migrate deploy && pnpm build"',
  '"pnpm prisma generate && pnpm build"'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated vercel.json buildCommand');