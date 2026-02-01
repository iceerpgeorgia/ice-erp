import { prisma } from "../lib/prisma";

const DECONSOLIDATED_TABLE = "GE78BG0000000893486000_BOG_GEL";

async function main() {
  const [row] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT c.raw_record_uuid
     FROM consolidated_bank_accounts c
     JOIN "${DECONSOLIDATED_TABLE}" d
       ON d.raw_record_uuid = c.raw_record_uuid
     ORDER BY c.id DESC
     LIMIT 1`
  );

  if (!row?.raw_record_uuid) {
    console.error("No matching raw_record_uuid found between tables.");
    return;
  }

  const rawRecordUuid = Array.isArray(row.raw_record_uuid)
    ? row.raw_record_uuid[0]
    : row.raw_record_uuid;
  console.log("Comparing raw_record_uuid:", rawRecordUuid, "type:", typeof rawRecordUuid);

  const [consolidated] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM consolidated_bank_accounts WHERE raw_record_uuid = '${rawRecordUuid}'::uuid LIMIT 1`
  );

  const [deconsolidated] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "${DECONSOLIDATED_TABLE}" WHERE raw_record_uuid = '${rawRecordUuid}'::uuid LIMIT 1`
  );

  if (!consolidated || !deconsolidated) {
    console.error("Missing row in one of the tables.");
    return;
  }

  const fields = [
    "counteragent_uuid",
    "project_uuid",
    "financial_code_uuid",
    "nominal_currency_uuid",
    "payment_id",
    "processing_case",
    "counteragent_processed",
    "parsing_rule_processed",
    "payment_id_processed",
  ];

  const diff: Record<string, { consolidated: any; deconsolidated: any }> = {};
  for (const field of fields) {
    const cVal = consolidated[field] ?? null;
    const dVal = deconsolidated[field] ?? null;
    if (String(cVal ?? "") !== String(dVal ?? "")) {
      diff[field] = { consolidated: cVal, deconsolidated: dVal };
    }
  }

  console.log("Consolidated:", consolidated);
  console.log("Deconsolidated:", deconsolidated);
  console.log("Differences:", diff);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
