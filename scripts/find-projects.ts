import fs from 'fs';
import { config } from 'dotenv';
import { prisma } from '../lib/prisma';

if (fs.existsSync('.env.local')) {
  config({ path: '.env.local' });
} else {
  config();
}

const term = process.argv[2];
if (!term) {
  console.error('Usage: tsx scripts/find-projects.ts <search-term>');
  process.exit(1);
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT project_uuid, project_name, project_index FROM projects WHERE project_name ILIKE $1 ORDER BY created_at DESC LIMIT 50',
    `%${term}%`
  );

  if (!rows.length) {
    console.log('No matches.');
    return;
  }

  rows.forEach((row) => {
    console.log(`${row.project_name} | ${row.project_index} | ${row.project_uuid}`);
  });
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });