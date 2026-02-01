import pg from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const { Client } = pg;

const run = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  const paymentId = 'ce1311_4e_3f247b';
  const res = await client.query(
    'select payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid from payments where payment_id = $1',
    [paymentId]
  );

  console.log(JSON.stringify(res.rows[0] ?? null, null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
