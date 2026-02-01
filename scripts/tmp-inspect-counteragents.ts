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
    '021bd4fd-8940-49c3-ba6a-74d4a2a0bb1f',
    '5da58dc3-3051-40d4-a10d-61eb144de9f7'
  ];

  const res = await client.query(
    'select counteragent_uuid, name, identification_number from counteragents where counteragent_uuid = any($1::uuid[])',
    [uuids]
  );

  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
