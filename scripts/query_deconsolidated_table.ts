import { prisma } from "../lib/prisma";

async function main() {
  const count = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    'SELECT COUNT(*)::int as count FROM "GE78BG0000000893486000_BOG_GEL"'
  );
  console.log("count", count);

  const sample = await prisma.$queryRawUnsafe(
    'SELECT id, transaction_date, description, account_currency_amount, counteragent_uuid, payment_id FROM "GE78BG0000000893486000_BOG_GEL" ORDER BY id DESC LIMIT 5'
  );
  console.log("sample", sample);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
