import pg from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const { Client } = pg;

const run = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  const uuid = '9cf8255a-3b4c-551a-92da-0f892550a06d';
  const table = 'GE78BG0000000893486000_BOG_GEL';

  await client.query(
    `update "${table}"
     set parsing_rule_applied = true,
         parsing_rule_processed = true,
         applied_rule_id = 91,
         updated_at = now()
     where raw_record_uuid = $1`,
    [uuid]
  );

  await client.end();
  console.log('Updated deconsolidated flags for 18337');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
