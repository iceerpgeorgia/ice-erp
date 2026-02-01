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
    `select id, uuid, doccomment, docprodgroup, docbenefinn, doccoracct, docbenefacctno, counteragent_uuid, applied_rule_id, parsing_rule_applied, parsing_rule_processed, parsing_rule_conflict, processing_case, updated_at from "${table}" where id in (18337, 18338) order by id`
  );

  console.log(JSON.stringify({ table, rows: res.rows }, null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
