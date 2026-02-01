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
  const id = 18338;

  const res = await client.query(
    `update "${table}" t
     set counteragent_uuid = p.counteragent_uuid,
         financial_code_uuid = coalesce(t.financial_code_uuid, p.financial_code_uuid),
         nominal_currency_uuid = coalesce(t.nominal_currency_uuid, p.currency_uuid),
         processing_case = 'Applied payment_id',
         updated_at = now()
     from payments p
     where t.id = $1 and t.payment_id = p.payment_id
     returning t.id, t.counteragent_uuid, t.financial_code_uuid, t.nominal_currency_uuid, t.payment_id`,
    [id]
  );

  console.log(JSON.stringify(res.rows[0] ?? null, null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
