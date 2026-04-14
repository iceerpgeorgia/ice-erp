const fs = require('fs');
const path = 'c:\\next-postgres-starter\\prisma\\schema.prisma';
let content = fs.readFileSync(path, 'utf8');

// Remove directUrl line
content = content.replace(/\r?\n\s*directUrl\s*=\s*env\("DIRECT_DATABASE_URL"\)/g, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Removed directUrl from schema.prisma');