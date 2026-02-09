require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS missing_count FROM bog_gel_raw_893486000 r LEFT JOIN "GE78BG0000000893486000_BOG_GEL" d ON r.dockey = d.dockey AND r.entriesid = d.entriesid WHERE d.dockey IS NULL'
    );
    console.log(rows?.[0]?.missing_count ?? rows);
  } finally {
    await prisma.$disconnect();
  }
})();
