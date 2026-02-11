import { prisma } from '../lib/prisma';

const projectUuids = [
  '684e42f3-7912-48db-b577-9d9d2834f4de',
  'fa29fbbe-3029-4837-adde-793c2ca8395d',
  'd786f320-a2c9-412c-b4be-a05de4861762',
  'e68ef0e0-13b9-4e5b-9b7b-4346ae24e7a6',
  'fa663957-1afd-4a7d-bf1e-18f0811873fc',
  'dedde9b8-c981-4d49-9a64-321230018684',
  '13b6b238-e95d-4330-9167-b02a26df224c',
  'e1fb87bb-f940-42bf-ac21-f89590d25883',
  '36da9ac9-fd85-4e9b-b6af-0cfcdd8e7d93',
  '64c5e4d7-bba6-4a45-ba66-fa1e66b0e138',
  '42a33c36-9ecc-4af0-9c4d-51b064a5f4be',
  '821ac8e7-29ff-417a-a4dd-2ec0b8afbd91',
  'a0dc3a44-ff44-406c-9a35-625b0c375406',
  'bb30cf11-f2b7-4538-b4ae-4e6b2d3e152f',
  '40cbbbc9-6d45-44b5-b444-aad5b7898901',
  '34b8252a-b352-4b53-8829-831191f45f9d',
  '84775209-02e2-47b7-ab93-434105e43323',
  '7b52b8fb-689a-4d49-8d34-bc72a92f96e7',
  '983d4226-1568-4120-9a00-7ada71216d53',
  '51c4f399-7516-49f6-8866-15dfa81b0dfa',
  '04882c6c-dd6b-4874-9e9a-ebe0e6e4391e',
  '44ee63f2-ba08-4974-a1bb-5e7685edc6bc',
  '2a0fd654-9360-49d7-a8a9-4b107127951e',
  '07066b48-2e48-40b9-954f-8c7b665da5bd',
  '22059889-dd7b-4edd-b729-9115c05b7e37',
  '39868c8f-40b2-4d1a-9d7b-5c9aa3a74a08',
  '7a8b7cb9-8b2a-4f36-8266-3229fc6cdc10',
  '85619090-cfc9-414d-b63c-31f431322e8b',
  'c7bf5a1d-f3dc-4d45-a4b3-ae3a08abb27e',
  '55787cc8-c7dd-4a23-9669-c83c2863fb2e',
  '6f2e0f98-f2a0-4f33-b359-d639c5918972',
  '8f037e09-90e9-4c9b-a993-afd83ccc0168',
  'bfca9047-3c75-4eeb-9fe8-82617ffd3965',
];

const run = async () => {
  const projectRows = await prisma.$queryRawUnsafe<
    Array<{
      project_uuid: string;
      counteragent_uuid: string;
      financial_code_uuid: string;
      currency_uuid: string;
    }>
  >(
    `SELECT project_uuid, counteragent_uuid, financial_code_uuid, currency_uuid
     FROM projects
     WHERE project_uuid = ANY($1::uuid[])`,
    projectUuids
  );

  const projectMap = new Map(projectRows.map((row) => [row.project_uuid, row]));
  const created: Array<{ project_uuid: string; payment_id: string }> = [];
  const skipped: Array<{ project_uuid: string; payment_id: string }> = [];
  const missing: string[] = [];

  for (const projectUuid of projectUuids) {
    const project = projectMap.get(projectUuid);
    if (!project) {
      missing.push(projectUuid);
      continue;
    }

    const existing = await prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
      `SELECT payment_id
       FROM payments
       WHERE counteragent_uuid = $1::uuid
         AND financial_code_uuid = $2::uuid
         AND currency_uuid = $3::uuid
         AND income_tax = false
         AND project_uuid = $4::uuid
         AND job_uuid IS NULL
         AND is_active = true
       LIMIT 1`,
      project.counteragent_uuid,
      project.financial_code_uuid,
      project.currency_uuid,
      project.project_uuid
    );

    if (existing.length > 0) {
      skipped.push({ project_uuid: projectUuid, payment_id: existing[0].payment_id });
      continue;
    }

    const insertRows = await prisma.$queryRawUnsafe<
      Array<{ payment_id: string }>
    >(
      `INSERT INTO payments (
         project_uuid,
         counteragent_uuid,
         financial_code_uuid,
         currency_uuid,
         income_tax,
         updated_at
       ) VALUES (
         $1::uuid,
         $2::uuid,
         $3::uuid,
         $4::uuid,
         false,
         NOW()
       )
       RETURNING payment_id`,
      project.project_uuid,
      project.counteragent_uuid,
      project.financial_code_uuid,
      project.currency_uuid
    );

    created.push({ project_uuid: projectUuid, payment_id: insertRows[0]?.payment_id || '' });
  }

  console.log({ created, skipped, missing });
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
