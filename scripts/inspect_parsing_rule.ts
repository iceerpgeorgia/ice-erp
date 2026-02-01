import { prisma } from "../lib/prisma";

const ruleId = Number(process.argv[2] || 0);
if (!ruleId) {
  console.error("Usage: pnpm exec tsx scripts/inspect_parsing_rule.ts <rule_id>");
  process.exit(1);
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT *
     FROM parsing_scheme_rules
     WHERE id = ${ruleId}
     LIMIT 1`
  );

  console.log(rows[0] || null);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
