import { prisma } from '../lib/prisma';

const table = process.argv[2] || 'GE78BG0000000893486000_BOG_GEL';

async function main() {
  const [dupCount] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int as count FROM "${table}" WHERE payment_id IN (SELECT duplicate_payment_id FROM payment_id_duplicates)`
  );
  const [dupLocked] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int as count FROM "${table}" WHERE payment_id IN (SELECT duplicate_payment_id FROM payment_id_duplicates) AND COALESCE(parsing_lock, false) = true`
  );
  const [dupDistinct] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(DISTINCT payment_id)::int as count FROM "${table}" WHERE payment_id IN (SELECT duplicate_payment_id FROM payment_id_duplicates)`
  );
  const [masterCount] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int as count FROM "${table}" WHERE payment_id IN (SELECT master_payment_id FROM payment_id_duplicates)`
  );

  console.log(JSON.stringify({
    table,
    duplicate_rows_remaining: dupCount?.count ?? 0,
    duplicate_rows_locked: dupLocked?.count ?? 0,
    duplicate_distinct_remaining: dupDistinct?.count ?? 0,
    master_rows_present: masterCount?.count ?? 0,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
