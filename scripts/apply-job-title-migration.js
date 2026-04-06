const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  await p.$executeRawUnsafe('ALTER TABLE counteragents ADD COLUMN IF NOT EXISTS job_title TEXT');
  console.log('job_title column added to counteragents');
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
