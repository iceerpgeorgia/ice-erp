import pg from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const { Client } = pg;

const run = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  const uuid = 'fe22167b-bdc5-5936-ab5c-7fc9984abf20';
  const table = 'GE78BG0000000893486000_BOG_GEL';

  await client.query('BEGIN');
  try {
    await client.query(
      `update bog_gel_raw_893486000
       set parsing_rule_applied = false,
           parsing_rule_processed = false,
           applied_rule_id = null,
           updated_at = now()
       where uuid = $1`,
      [uuid]
    );

    await client.query(
      `update "${table}"
       set counteragent_uuid = null,
           parsing_rule_processed = false,
           parsing_rule_applied = false,
           applied_rule_id = null,
           processing_case = null,
           updated_at = now()
       where raw_record_uuid = $1`,
      [uuid]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  console.log('Reverted rule 91 effects for 18338');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
