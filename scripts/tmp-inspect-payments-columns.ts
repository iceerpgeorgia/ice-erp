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
    "select column_name from information_schema.columns where table_schema='public' and table_name='payments' order by ordinal_position"
  );

  console.log(res.rows.map((row) => row.column_name));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
