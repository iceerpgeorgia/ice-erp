import fs from 'fs';
import { config } from 'dotenv';
import { prisma } from '../lib/prisma';

if (fs.existsSync('.env.local')) {
  config({ path: '.env.local' });
} else {
  config();
}

type PaymentSeedRow = {
  projectUuid: string;
  financialCodeUuid: string;
  currencyCode: string;
};

const rows: PaymentSeedRow[] = [
  { projectUuid: '684e42f3-7912-48db-b577-9d9d2834f4de', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'GEL' },
  { projectUuid: 'fa29fbbe-3029-4837-adde-793c2ca8395d', financialCodeUuid: 'b59170ec-16cc-499a-9ff7-0428dcb8f727', currencyCode: 'USD' },
  { projectUuid: 'd786f320-a2c9-412c-b4be-a05de4861762', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: 'e68ef0e0-13b9-4e5b-9b7b-4346ae24e7a6', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: 'fa663957-1afd-4a7d-bf1e-18f0811873fc', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: 'dedde9b8-c981-4d49-9a64-321230018684', financialCodeUuid: 'b5caa716-ca9b-47d4-85d4-9954ed4dbad2', currencyCode: 'USD' },
  { projectUuid: '13b6b238-e95d-4330-9167-b02a26df224c', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: 'e1fb87bb-f940-42bf-ac21-f89590d25883', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'EUR' },
  { projectUuid: '36da9ac9-fd85-4e9b-b6af-0cfcdd8e7d93', financialCodeUuid: '12238130-9d12-4099-a48b-9eb5a085e0f8', currencyCode: 'GEL' },
  { projectUuid: '64c5e4d7-bba6-4a45-ba66-fa1e66b0e138', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '42a33c36-9ecc-4af0-9c4d-51b064a5f4be', financialCodeUuid: 'b5caa716-ca9b-47d4-85d4-9954ed4dbad2', currencyCode: 'GEL' },
  { projectUuid: '821ac8e7-29ff-417a-a4dd-2ec0b8afbd91', financialCodeUuid: 'b5caa716-ca9b-47d4-85d4-9954ed4dbad2', currencyCode: 'GEL' },
  { projectUuid: 'a0dc3a44-ff44-406c-9a35-625b0c375406', financialCodeUuid: 'b5caa716-ca9b-47d4-85d4-9954ed4dbad2', currencyCode: 'GEL' },
  { projectUuid: 'bb30cf11-f2b7-4538-b4ae-4e6b2d3e152f', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'GEL' },
  { projectUuid: '40cbbbc9-6d45-44b5-b444-aad5b7898901', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '34b8252a-b352-4b53-8829-831191f45f9d', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '84775209-02e2-47b7-ab93-434105e43323', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'EUR' },
  { projectUuid: '7b52b8fb-689a-4d49-8d34-bc72a92f96e7', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '983d4226-1568-4120-9a00-7ada71216d53', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '51c4f399-7516-49f6-8866-15dfa81b0dfa', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '04882c6c-dd6b-4874-9e9a-ebe0e6e4391e', financialCodeUuid: 'b5caa716-ca9b-47d4-85d4-9954ed4dbad2', currencyCode: 'USD' },
  { projectUuid: '44ee63f2-ba08-4974-a1bb-5e7685edc6bc', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '2a0fd654-9360-49d7-a8a9-4b107127951e', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'EUR' },
  { projectUuid: '07066b48-2e48-40b9-954f-8c7b665da5bd', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '22059889-dd7b-4edd-b729-9115c05b7e37', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'EUR' },
  { projectUuid: '39868c8f-40b2-4d1a-9d7b-5c9aa3a74a08', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'EUR' },
  { projectUuid: '7a8b7cb9-8b2a-4f36-8266-3229fc6cdc10', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '85619090-cfc9-414d-b63c-31f431322e8b', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: 'c7bf5a1d-f3dc-4d45-a4b3-ae3a08abb27e', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '55787cc8-c7dd-4a23-9669-c83c2863fb2e', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: '6f2e0f98-f2a0-4f33-b359-d639c5918972', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'GEL' },
  { projectUuid: '8f037e09-90e9-4c9b-a993-afd83ccc0168', financialCodeUuid: 'fea4b88f-633f-4422-b3d6-250792a2da80', currencyCode: 'USD' },
  { projectUuid: 'bfca9047-3c75-4eeb-9fe8-82617ffd3965', financialCodeUuid: 'b59170ec-16cc-499a-9ff7-0428dcb8f727', currencyCode: 'USD' },
];

async function getCounteragentUuid(projectUuid: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT counteragent_uuid FROM projects WHERE project_uuid = $1::uuid LIMIT 1',
    projectUuid
  );
  if (rows.length === 0) throw new Error(`Project not found: ${projectUuid}`);
  return rows[0].counteragent_uuid as string;
}

async function getCurrencyUuid(code: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT uuid FROM currencies WHERE code = $1 LIMIT 1',
    code
  );
  if (rows.length === 0) throw new Error(`Currency not found: ${code}`);
  return rows[0].uuid as string;
}

async function ensurePayment(
  projectUuid: string,
  counteragentUuid: string,
  financialCodeUuid: string,
  currencyUuid: string
) {
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT payment_id FROM payments
     WHERE counteragent_uuid = $1::uuid
       AND financial_code_uuid = $2::uuid
       AND currency_uuid = $3::uuid
       AND income_tax = false
       AND project_uuid IS NOT DISTINCT FROM $4::uuid
       AND job_uuid IS NULL
       AND is_active = true
     LIMIT 1`,
    counteragentUuid,
    financialCodeUuid,
    currencyUuid,
    projectUuid
  );

  if (existing.length > 0) {
    return { created: false, paymentId: existing[0].payment_id as string };
  }

  const inserted = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO payments (
      project_uuid,
      counteragent_uuid,
      financial_code_uuid,
      job_uuid,
      income_tax,
      currency_uuid,
      accrual_source,
      payment_id,
      record_uuid,
      updated_at
    ) VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      NULL,
      false,
      $4::uuid,
      NULL,
      '',
      '',
      NOW()
    ) RETURNING payment_id`,
    projectUuid,
    counteragentUuid,
    financialCodeUuid,
    currencyUuid
  );

  return { created: true, paymentId: inserted[0]?.payment_id as string };
}

async function main() {
  const results: Array<{ projectUuid: string; paymentId: string; created: boolean }> = [];
  const failures: Array<{ projectUuid: string; reason: string }> = [];

  for (const row of rows) {
    try {
      const counteragentUuid = await getCounteragentUuid(row.projectUuid);
      const currencyUuid = await getCurrencyUuid(row.currencyCode);

      const outcome = await ensurePayment(
        row.projectUuid,
        counteragentUuid,
        row.financialCodeUuid,
        currencyUuid
      );

      results.push({
        projectUuid: row.projectUuid,
        paymentId: outcome.paymentId,
        created: outcome.created,
      });
    } catch (error: any) {
      failures.push({
        projectUuid: row.projectUuid,
        reason: error?.message || 'Unknown error',
      });
    }
  }

  const created = results.filter((r) => r.created);
  const skipped = results.filter((r) => !r.created);

  console.log(`Created: ${created.length}`);
  created.forEach((row) => console.log(`  + ${row.projectUuid}: ${row.paymentId}`));
  console.log(`Skipped (existing): ${skipped.length}`);
  skipped.forEach((row) => console.log(`  - ${row.projectUuid}: ${row.paymentId}`));

  if (failures.length > 0) {
    console.log(`Failed: ${failures.length}`);
    failures.forEach((row) => console.log(`  ! ${row.projectUuid}: ${row.reason}`));
  }
}

main()
  .catch((error) => {
    console.error('Failed to create payments:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });