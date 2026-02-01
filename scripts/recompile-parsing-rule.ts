import { PrismaClient } from '@prisma/client';
import { compileFormulaToJS } from '../lib/formula-compiler';

const ruleId = Number(process.argv[2] || 0);
if (!ruleId) {
  console.error('Usage: pnpm tsx scripts/recompile-parsing-rule.ts <ruleId>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const rules = await prisma.$queryRawUnsafe<Array<{ id: number; condition: string }>>(
    'SELECT id, condition FROM parsing_scheme_rules WHERE id = $1',
    ruleId
  );

  if (!rules.length) {
    console.error(`Rule ${ruleId} not found`);
    return;
  }

  const condition = rules[0].condition;
  const script = compileFormulaToJS(condition);

  await prisma.$executeRawUnsafe(
    'UPDATE parsing_scheme_rules SET condition_script = $1 WHERE id = $2',
    script,
    ruleId
  );

  console.log(`Recompiled rule ${ruleId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
