import pg from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const { Client } = pg;

const run = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  const uuids = [
    '9cf8255a-3b4c-551a-92da-0f892550a06d',
    'fe22167b-bdc5-5936-ab5c-7fc9984abf20'
  ];

  const res = await client.query(
    'select raw_record_uuid, counteragent_uuid, processing_case from consolidated_bank_accounts where raw_record_uuid = any($1::uuid[])',
    [uuids]
  );

  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
