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
  const results = await prisma.$queryRawUnsafe<any[]>(
    `WITH target AS (
        SELECT dockey
        FROM "${tableName}"
        WHERE entriesid::text LIKE '%00000'
        GROUP BY dockey
      )
      SELECT t.dockey,
             COUNT(*) AS total_rows,
             SUM(CASE WHEN e.entriesid::text LIKE '%00000' THEN 1 ELSE 0 END) AS ending_00000,
             SUM(CASE WHEN e.entriesid::text NOT LIKE '%00000' THEN 1 ELSE 0 END) AS other_entries
      FROM "${tableName}" e
      JOIN target t ON t.dockey = e.dockey
      GROUP BY t.dockey
      HAVING SUM(CASE WHEN e.entriesid::text NOT LIKE '%00000' THEN 1 ELSE 0 END) > 0
      ORDER BY other_entries DESC, total_rows DESC, t.dockey ASC`
  );

  console.log(`Dockeys with entriesid ending 00000 and additional entries: ${results.length}`);
  results.forEach((row) => {
    console.log(
      `${row.dockey} | total=${row.total_rows} | ending_00000=${row.ending_00000} | other=${row.other_entries}`
    );
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