import { PrismaClient } from '@prisma/client';

const ruleId = Number(process.argv[2] || 0);
if (!ruleId) {
  console.error('Usage: pnpm tsx scripts/check-parsing-rule.ts <ruleId>');
  process.exit(1);
}

const prisma = new PrismaClient();
const DECONSOLIDATED_TABLE = "GE78BG0000000893486000_BOG_GEL";

async function main() {
  const rules = await prisma.$queryRawUnsafe<Array<{ id: number; condition: string; condition_script: string | null }>>(
    'SELECT id, condition, condition_script FROM parsing_scheme_rules WHERE id = $1',
    ruleId
  );
  if (!rules.length) {
    console.error(`Rule ${ruleId} not found`);
    return;
  }

  const rule = rules[0];
  if (!rule.condition_script) {
    console.error(`Rule ${ruleId} has no condition_script`);
    return;
  }

  const rawRecords = await prisma.$queryRawUnsafe<Array<any>>(`
    SELECT
      uuid,
      DocRecDate as transaction_date,
      EntryDbAmt as debit,
      EntryCrAmt as credit,
      DocInformation as description,
      DocInformation as docinformation,
      DocSenderAcctNo as sender_account,
      DocBenefAcctNo as beneficiary_account,
      DocSenderName as sender_name,
      DocBenefName as beneficiary_name,
      processing_case,
      DocProdGroup,
      DocCorAcct,
      DocSenderInn,
      DocBenefInn,
      DocComment as doccomment
    FROM bog_gel_raw_893486000
    LIMIT 50000
  `);

  const evalFunc = eval(rule.condition_script);
  const matchingRecords = rawRecords.filter((record) => {
    try {
      return evalFunc(record);
    } catch {
      return false;
    }
  });

  const uuids = matchingRecords.map((r) => r.uuid);

  let deconsolidatedMatches = 0;
  if (uuids.length) {
    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint as count FROM "${DECONSOLIDATED_TABLE}" WHERE raw_record_uuid = ANY($1::uuid[])`,
      uuids
    );
    deconsolidatedMatches = Number(result[0]?.count ?? 0);
  }

  console.log(JSON.stringify({
    ruleId,
    condition: rule.condition,
    matchCount: matchingRecords.length,
    deconsolidatedMatches,
    sampleUuids: uuids.slice(0, 5)
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
