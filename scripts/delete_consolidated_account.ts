import { prisma } from "../lib/prisma";

const accountUuid = process.argv[2];
if (!accountUuid) {
  console.error("Usage: pnpm exec tsx scripts/delete_consolidated_account.ts <bank_account_uuid>");
  process.exit(1);
}

async function main() {
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM consolidated_bank_accounts WHERE bank_account_uuid = '${accountUuid}'::uuid`
  );
  console.log({ deleted: result });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
