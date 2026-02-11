import fs from 'fs';
import { config } from 'dotenv';
import { prisma } from '../lib/prisma';

if (fs.existsSync('.env.local')) {
  config({ path: '.env.local' });
} else {
  config();
}

const tableName = 'GE78BG0000000893486000_BOG_GEL';

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `WITH ending AS (
        SELECT dockey, COUNT(*) AS ending_count
        FROM "${tableName}"
        WHERE entriesid::text LIKE '%00000'
        GROUP BY dockey
      ), totals AS (
        SELECT dockey, COUNT(*) AS total_count
        FROM "${tableName}"
        GROUP BY dockey
      )
      SELECT e.dockey, e.ending_count, t.total_count
      FROM ending e
      JOIN totals t ON t.dockey = e.dockey
      WHERE t.total_count = e.ending_count
      ORDER BY e.dockey ASC`
  );

  console.log(`Dockeys with only entriesid ending 00000: ${rows.length}`);
  rows.forEach((row) => {
    console.log(`${row.dockey} | total=${row.total_count} | ending_00000=${row.ending_count}`);
  });
}

main()
  .catch((error) => {
    console.error('Failed to inspect entries:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });