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
    `select id, created_at, "table", record_id, action, changes
     from "AuditLog"
     where "table" = 'payments_ledger'
     order by created_at desc
     limit 20`
  );

  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
