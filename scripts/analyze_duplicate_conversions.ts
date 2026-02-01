import { prisma } from '../lib/prisma';

const table = process.argv[2] || 'GE78BG0000000893486000_BOG_GEL';

async function main() {
  const [converted] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int as count
     FROM "${table}" t
     JOIN payment_id_duplicates d
       ON t.payment_id = d.master_payment_id
     WHERE COALESCE(t.parsing_lock, false) = false
       AND t.docinformation ILIKE '%' || d.duplicate_payment_id || '%'`
  );

  const [distinctConverted] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(DISTINCT d.duplicate_payment_id)::int as count
     FROM "${table}" t
     JOIN payment_id_duplicates d
       ON t.payment_id = d.master_payment_id
     WHERE COALESCE(t.parsing_lock, false) = false
       AND t.docinformation ILIKE '%' || d.duplicate_payment_id || '%'`
  );

  console.log(JSON.stringify({
    table,
    converted_rows_estimate: converted?.count ?? 0,
    distinct_duplicate_ids_converted_estimate: distinctConverted?.count ?? 0,
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
