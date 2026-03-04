const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(process.cwd(), 'waybills_projects_codes.csv');
const BATCH_SIZE = 200;

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  return lines.slice(1).map((line) => {
    const [idRaw, projectRaw, financialRaw, correspondingAccountRaw] = line.split(',');
    return {
      rsId: (idRaw || '').trim(),
      projectUuid: (projectRaw || '').trim() || null,
      financialCodeUuid: (financialRaw || '').trim() || null,
      correspondingAccount: (correspondingAccountRaw || '').trim() || null,
    };
  }).filter((row) => row.rsId);
}

async function run() {
  const prisma = new PrismaClient();
  try {
    console.log('Starting waybills mapping sync...');
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(`CSV not found: ${CSV_PATH}`);
    }

    const mappings = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
    const ids = [...new Set(mappings.map((m) => m.rsId))];
    console.log(`Parsed ${mappings.length} CSV rows (${ids.length} unique rs_id values)`);

    const existingRows = await prisma.rs_waybills_in.findMany({
      where: { rs_id: { in: ids } },
      select: { rs_id: true, project_uuid: true, financial_code_uuid: true, corresponding_account: true },
    });

    const existingByRsId = new Map(existingRows.map((row) => [String(row.rs_id), row]));

    const toUpdate = [];
    let missingRows = 0;

    for (const mapping of mappings) {
      const current = existingByRsId.get(mapping.rsId);
      if (!current) {
        missingRows += 1;
        continue;
      }

      const currentProject = current.project_uuid ?? null;
      const currentFinancialCode = current.financial_code_uuid ?? null;
      const currentCorrespondingAccount = current.corresponding_account ?? null;

      if (
        currentProject !== mapping.projectUuid ||
        currentFinancialCode !== mapping.financialCodeUuid ||
        currentCorrespondingAccount !== mapping.correspondingAccount
      ) {
        toUpdate.push(mapping);
      }
    }

    let updatedRows = 0;

    for (let index = 0; index < toUpdate.length; index += BATCH_SIZE) {
      const batch = toUpdate.slice(index, index + BATCH_SIZE);
      const operations = batch.map((mapping) => prisma.rs_waybills_in.updateMany({
        where: { rs_id: mapping.rsId },
        data: {
          project_uuid: mapping.projectUuid,
          financial_code_uuid: mapping.financialCodeUuid,
          corresponding_account: mapping.correspondingAccount,
        },
      }));

      const results = await prisma.$transaction(operations);
      updatedRows += results.reduce((sum, result) => sum + (result.count || 0), 0);
    }
    console.log(`Updated rows: ${updatedRows}`);

    const reloadedRows = await prisma.rs_waybills_in.findMany({
      where: { rs_id: { in: ids } },
      select: { rs_id: true, project_uuid: true, financial_code_uuid: true, corresponding_account: true },
    });

    const reloadedByRsId = new Map(reloadedRows.map((row) => [String(row.rs_id), row]));

    let exactMatches = 0;
    let mismatches = 0;

    for (const mapping of mappings) {
      const row = reloadedByRsId.get(mapping.rsId);
      if (!row) {
        continue;
      }
      const projectUuid = row.project_uuid ?? null;
      const financialCodeUuid = row.financial_code_uuid ?? null;
      const correspondingAccount = row.corresponding_account ?? null;
      if (
        projectUuid === mapping.projectUuid &&
        financialCodeUuid === mapping.financialCodeUuid &&
        correspondingAccount === mapping.correspondingAccount
      ) {
        exactMatches += 1;
      } else {
        mismatches += 1;
      }
    }

    console.log(JSON.stringify({
      csvRows: mappings.length,
      uniqueRsIds: ids.length,
      tableRowsFound: existingRows.length,
      tableRowsMissing: missingRows,
      rowsNeedingChange: toUpdate.length,
      rowsUpdated: updatedRows,
      exactMatchesAfter: exactMatches,
      mismatchesAfter: mismatches,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error('Mapping sync failed:', error?.stack || error?.message || String(error));
  process.exit(1);
});
