import pg from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const { Client } = pg;

const run = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  const table = 'GE78BG0000000893486000_BOG_GEL';
  const res = await client.query(
    `select id, raw_record_uuid, description, doccomment, docinformation, payment_id, counteragent_uuid from "${table}" where id = 18338`
  );

  console.log(JSON.stringify(res.rows[0] ?? null, null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
