const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const tableExists = async (tableName) => {
  const rows = await prisma.$queryRaw`
    SELECT to_regclass(${`public.${tableName}`})::text as regclass
  `;
  return Array.isArray(rows) && rows[0] && rows[0].regclass !== null;
};

const normalizeIdentificationNumber = (value) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `0${digits}`;
  return digits;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = { inn: null, keepId: null, keepUuid: null, dryRun: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--inn') result.inn = args[i + 1];
    if (arg === '--keep-id') result.keepId = args[i + 1];
    if (arg === '--keep-uuid') result.keepUuid = args[i + 1];
    if (arg === '--dry-run') result.dryRun = true;
  }
  return result;
};

const main = async () => {
  const { inn, keepId, keepUuid, dryRun } = parseArgs();
  const target = normalizeIdentificationNumber(inn);

  if (!target) {
    console.error('Usage: node scripts/consolidate-counteragents.js --inn <IDENTIFICATION_NUMBER> [--keep-id <ID> | --keep-uuid <UUID>] [--dry-run]');
    process.exit(1);
  }

  const counteragents = await prisma.counteragents.findMany({
    where: { identification_number: { not: null } },
    select: {
      id: true,
      counteragent_uuid: true,
      identification_number: true,
      created_at: true,
      name: true,
    },
  });

  const matches = counteragents.filter(
    (row) => normalizeIdentificationNumber(row.identification_number) === target
  );

  if (matches.length < 2) {
    console.log(`No duplicates found for identification_number ${target}.`);
    return;
  }

  let canonical = null;
  if (keepId) {
    canonical = matches.find((row) => String(row.id) === String(keepId));
  } else if (keepUuid) {
    canonical = matches.find((row) => row.counteragent_uuid === keepUuid);
  }

  if (!canonical) {
    canonical = [...matches].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return Number(a.id) - Number(b.id);
    })[0];
  }

  const duplicates = matches.filter((row) => row.id !== canonical.id);
  const duplicateUuids = duplicates.map((row) => row.counteragent_uuid);
  const duplicateIds = duplicates.map((row) => row.id);

  console.log('Canonical counteragent:', canonical);
  console.log('Duplicate counteragents:', duplicates);

  if (dryRun) {
    console.log('Dry run enabled. No changes applied.');
    return;
  }

  const operations = [];
  operations.push(
    prisma.payments.updateMany({
      where: { counteragent_uuid: { in: duplicateUuids } },
      data: { counteragent_uuid: canonical.counteragent_uuid },
    })
  );
  operations.push(
    prisma.projects.updateMany({
      where: { counteragent_uuid: { in: duplicateUuids } },
      data: { counteragent_uuid: canonical.counteragent_uuid },
    })
  );
  operations.push(
    prisma.parsing_scheme_rules.updateMany({
      where: { counteragent_uuid: { in: duplicateUuids } },
      data: { counteragent_uuid: canonical.counteragent_uuid },
    })
  );
  operations.push(
    prisma.consolidatedBankAccount.updateMany({
      where: { counteragentUuid: { in: duplicateUuids } },
      data: { counteragentUuid: canonical.counteragent_uuid },
    })
  );
  operations.push(
    prisma.salary_accruals.updateMany({
      where: { counteragent_uuid: { in: duplicateUuids } },
      data: { counteragent_uuid: canonical.counteragent_uuid },
    })
  );
  if (await tableExists('transactions')) {
    operations.push(
      prisma.transactions.updateMany({
        where: { counteragent_id: { in: duplicateIds } },
        data: { counteragent_id: canonical.id },
      })
    );
  } else {
    console.warn('Skipping transactions update (table not found).');
  }

  if (await tableExists('rs_waybills_in')) {
    operations.push(
      prisma.rs_waybills_in.updateMany({
        where: { counteragent_uuid: { in: duplicateUuids } },
        data: { counteragent_uuid: canonical.counteragent_uuid },
      })
    );
  } else {
    console.warn('Skipping rs_waybills_in update (table not found).');
  }

  const results = await prisma.$transaction(operations);
  const updatedCounts = results.map((result) => result.count || 0);
  console.log('Updated counts:', updatedCounts);

  const deleted = await prisma.counteragents.deleteMany({
    where: { id: { in: duplicateIds } },
  });

  console.log(`Deleted ${deleted.count} duplicate counteragent(s).`);
};

main()
  .catch((error) => {
    console.error('Consolidation failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
