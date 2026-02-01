import pg from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const { Client } = pg;

const run = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  const res = await client.query(
    'select id, counteragent_uuid, financial_code_uuid, nominal_currency_uuid, payment_id from parsing_scheme_rules where id=$1',
    [91]
  );

  console.log(JSON.stringify(res.rows[0] ?? null, null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
