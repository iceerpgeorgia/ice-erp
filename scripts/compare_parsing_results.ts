import { prisma } from "../lib/prisma";

const DECONSOLIDATED_TABLE = "GE78BG0000000893486000_BOG_GEL";

const fields = [
  "counteragent_uuid",
  "project_uuid",
  "financial_code_uuid",
  "nominal_currency_uuid",
  "payment_id",
  "processing_case",
  "applied_rule_id",
];

const pairedFields = [
  "processing_case",
  "applied_rule_id",
];

async function main() {
  const pairs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT c.raw_record_uuid
     FROM consolidated_bank_accounts c
     JOIN "${DECONSOLIDATED_TABLE}" d
       ON d.raw_record_uuid = c.raw_record_uuid
     ORDER BY c.id DESC
     LIMIT 200`
  );

  const diffs: Record<string, number> = {};
  const pairedDiffs: Record<string, Record<string, number>> = {};
  const counteragentDiffs = { bothDifferent: 0, consolidatedNull: 0, deconsolidatedNull: 0 };
  let compared = 0;
  const samples: Array<{ raw_record_uuid: string; differences: Record<string, { consolidated: any; deconsolidated: any }> }> = [];

  for (const row of pairs) {
    const rawRecordUuid = row.raw_record_uuid;
    const [consolidated] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM consolidated_bank_accounts WHERE raw_record_uuid = '${rawRecordUuid}'::uuid ORDER BY id DESC LIMIT 1`
    );
    const [deconsolidated] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${DECONSOLIDATED_TABLE}" WHERE raw_record_uuid = '${rawRecordUuid}'::uuid LIMIT 1`
    );

    if (!consolidated || !deconsolidated) continue;
    compared += 1;

    const recordDiff: Record<string, { consolidated: any; deconsolidated: any }> = {};
    for (const field of fields) {
      const cVal = consolidated[field] ?? null;
      const dVal = deconsolidated[field] ?? null;
      if (String(cVal ?? "") !== String(dVal ?? "")) {
        diffs[field] = (diffs[field] || 0) + 1;
        recordDiff[field] = { consolidated: cVal, deconsolidated: dVal };

        if (field === "counteragent_uuid") {
          if (cVal === null && dVal !== null) counteragentDiffs.consolidatedNull += 1;
          else if (cVal !== null && dVal === null) counteragentDiffs.deconsolidatedNull += 1;
          else counteragentDiffs.bothDifferent += 1;
        }
      }
    }

    for (const field of pairedFields) {
      const cVal = consolidated[field] ?? null;
      const dVal = deconsolidated[field] ?? null;
      if (String(cVal ?? "") !== String(dVal ?? "")) {
        const key = `${cVal ?? "null"} => ${dVal ?? "null"}`;
        pairedDiffs[field] = pairedDiffs[field] || {};
        pairedDiffs[field][key] = (pairedDiffs[field][key] || 0) + 1;
      }
    }

    if (Object.keys(recordDiff).length && samples.length < 10) {
      samples.push({ raw_record_uuid: rawRecordUuid, differences: recordDiff });
    }
  }

  console.log("compared", compared);
  console.log("diffCounts", diffs);
  console.log("counteragentDiffs", counteragentDiffs);
  console.log("pairedDiffs", pairedDiffs);
  console.log("sampleDiffs", JSON.stringify(samples, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
