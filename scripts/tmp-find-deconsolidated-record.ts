import pg from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const { Client } = pg;

const run = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL not set');
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const tables = await client.query(
    "select table_name from information_schema.columns where table_schema='public' and column_name='id' and table_name ilike '%_bog_gel%'"
  );

  let found: { table: string; row: Record<string, any> } | null = null;
  for (const row of tables.rows) {
    const name = row.table_name as string;
    const res = await client.query(`select * from "${name}" where id=$1`, [18337]);
    if (res.rows.length) {
      found = { table: name, row: res.rows[0] };
      break;
    }
  }

  if (!found) {
    console.log('NOT_FOUND');
  } else {
    console.log(JSON.stringify(found, null, 2));
  }

  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
