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
    `select uuid, docsenderinn, docbenefinn, docsenderacctno, docbenefacctno, doccoracct, entrydbamt, entrycramt from bog_gel_raw_893486000 where uuid = $1`,
    ['fe22167b-bdc5-5936-ab5c-7fc9984abf20']
  );

  console.log(JSON.stringify(res.rows[0] ?? null, null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
