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
  const candidates = await prisma.$queryRawUnsafe<any[]>(
    `WITH target AS (
        SELECT dockey
        FROM "${tableName}"
        WHERE entriesid::text LIKE '%00000'
        GROUP BY dockey
      )
      SELECT e.id, e.dockey, e.entriesid
      FROM "${tableName}" e
      JOIN target t ON t.dockey = e.dockey
      WHERE e.entriesid::text LIKE '%00000'
        AND EXISTS (
          SELECT 1
          FROM "${tableName}" x
          WHERE x.dockey = e.dockey
            AND x.entriesid::text NOT LIKE '%00000'
        )
      ORDER BY e.dockey ASC, e.id ASC`
  );

  if (candidates.length === 0) {
    console.log('No duplicate 00000-ending rows found to delete.');
    return;
  }

  const ids = candidates.map((row) => row.id);
  const deleteResult = await prisma.$queryRawUnsafe<any[]>(
    `DELETE FROM "${tableName}"
     WHERE id = ANY($1::bigint[])
     RETURNING id, dockey, entriesid`,
    ids
  );

  console.log(`Deleted rows: ${deleteResult.length}`);
  deleteResult.forEach((row) => {
    console.log(`${row.id} | ${row.dockey} | ${row.entriesid}`);
  });
}

main()
  .catch((error) => {
    console.error('Delete failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });