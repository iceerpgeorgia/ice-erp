const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const rawInput = fs.readFileSync(path.join(__dirname, '../data/payment-combos.raw.txt'), 'utf8');
const tokens = rawInput.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|usd|gel|eur|0/gi) || [];
const INPUT = [];
for (let i = 0; i < tokens.length; i += 3) {
  INPUT.push([tokens[i], tokens[i + 1], tokens[i + 2]]);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatPaymentId(hex14) {
  return `${hex14.slice(0, 6)}_${hex14.slice(6, 8)}_${hex14.slice(8, 14)}`;
}

async function generateUniquePaymentId() {
  while (true) {
    const hex = crypto.randomBytes(7).toString('hex');
    const candidate = formatPaymentId(hex);
    const existing = await prisma.payments.findUnique({
      where: { payment_id: candidate },
      select: { payment_id: true },
    });
    if (!existing) return candidate;
  }
}

async function main() {
  const currencyRows = await prisma.currencies.findMany({
    select: { uuid: true, code: true },
  });
  const currencyMap = new Map(currencyRows.map((row) => [row.code.toUpperCase(), row.uuid]));

  const projectIds = [...new Set(INPUT.map(([projectUuid]) => projectUuid))].filter((id) => UUID_REGEX.test(id));
  const projects = await prisma.projects.findMany({
    where: { project_uuid: { in: projectIds } },
    select: { project_uuid: true, counteragent_uuid: true },
  });
  const projectMap = new Map(projects.map((row) => [row.project_uuid, row.counteragent_uuid]));

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const [projectUuid, financialCodeUuid, iso] of INPUT) {
    const currencyCode = String(iso || '').toUpperCase();
    const currencyUuid = currencyMap.get(currencyCode);

    if (!UUID_REGEX.test(projectUuid)) {
      errors.push({ projectUuid, financialCodeUuid, iso, error: 'Invalid project_uuid' });
      continue;
    }
    if (!UUID_REGEX.test(financialCodeUuid)) {
      errors.push({ projectUuid, financialCodeUuid, iso, error: 'Invalid financial_code_uuid' });
      continue;
    }
    if (!currencyUuid) {
      errors.push({ projectUuid, financialCodeUuid, iso, error: 'Unknown currency code' });
      continue;
    }

    const counteragentUuid = projectMap.get(projectUuid);
    if (!counteragentUuid) {
      errors.push({ projectUuid, financialCodeUuid, iso, error: 'Project counteragent not found' });
      continue;
    }

    const existing = await prisma.payments.findFirst({
      where: {
        project_uuid: projectUuid,
        counteragent_uuid: counteragentUuid,
        financial_code_uuid: financialCodeUuid,
        job_uuid: null,
        income_tax: false,
        currency_uuid: currencyUuid,
      },
      select: { payment_id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const paymentId = await generateUniquePaymentId();
    await prisma.payments.create({
      data: {
        project_uuid: projectUuid,
        counteragent_uuid: counteragentUuid,
        financial_code_uuid: financialCodeUuid,
        job_uuid: null,
        payment_id: paymentId,
        record_uuid: crypto.randomUUID(),
        is_active: true,
        income_tax: false,
        currency_uuid: currencyUuid,
        accrual_source: null,
        updated_at: new Date(),
      },
    });

    created++;
  }

  console.log(`Created: ${created}`);
  console.log(`Skipped (already exists): ${skipped}`);
  if (errors.length) {
    console.log('Errors:');
    for (const err of errors) console.log(err);
  }
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
