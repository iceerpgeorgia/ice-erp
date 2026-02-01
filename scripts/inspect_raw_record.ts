import { prisma } from "../lib/prisma";

const rawRecordUuid = process.argv[2];
if (!rawRecordUuid) {
  console.error("Usage: pnpm exec tsx scripts/inspect_raw_record.ts <raw_record_uuid>");
  process.exit(1);
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT docprodgroup, docsenderinn, docbenefinn, docinformation, entrydbamt, entrycramt, doccoracct, docsenderacctno, docbenefacctno
     FROM bog_gel_raw_893486000
     WHERE uuid = '${rawRecordUuid}'::uuid
     LIMIT 1`
  );
  const deconsolidated = await prisma.$queryRawUnsafe<any[]>(
    `SELECT docprodgroup, applied_rule_id, processing_case, counteragent_uuid, payment_id
     FROM "GE78BG0000000893486000_BOG_GEL"
     WHERE raw_record_uuid = '${rawRecordUuid}'::uuid
     LIMIT 1`
  );

  const consolidated = await prisma.$queryRawUnsafe<any[]>(
    `SELECT applied_rule_id, processing_case, counteragent_uuid, project_uuid, financial_code_uuid, payment_id
     FROM consolidated_bank_accounts
     WHERE raw_record_uuid = '${rawRecordUuid}'::uuid
     LIMIT 1`
  );

  const consolidatedAll = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, applied_rule_id, processing_case, payment_id
     FROM consolidated_bank_accounts
     WHERE raw_record_uuid = '${rawRecordUuid}'::uuid
     ORDER BY id DESC
     LIMIT 5`
  );

  console.log({
    raw: rows[0] || null,
    deconsolidated: deconsolidated[0] || null,
    consolidated: consolidated[0] || null,
    consolidatedLatest: consolidatedAll,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
