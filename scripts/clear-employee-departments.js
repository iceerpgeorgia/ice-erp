const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  await p.$executeRawUnsafe('ALTER TABLE counteragents DROP CONSTRAINT IF EXISTS chk_employee_department');
  const updated = await p.$executeRawUnsafe('UPDATE counteragents SET department = NULL WHERE is_emploee = true');
  console.log('Constraint dropped. Employee departments cleared:', updated, 'rows');
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
