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
    `select id, uuid, DocProdGroup, DocComment, DocBenefInn, DocCorAcct, DocBenefAcctNo from bog_gel_raw_893486000 where id in (18337, 18338) order by id`
  );

  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
