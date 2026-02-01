import pg from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const { Client } = pg;

const run = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  const query = `
    SELECT
      (SELECT COUNT(*)::int FROM bog_gel_raw_893486000) AS raw_total,
      (SELECT COUNT(*)::int FROM "GE78BG0000000893486000_BOG_GEL") AS deconsolidated_total,
      (SELECT COUNT(*)::int FROM bog_gel_raw_893486000 r
        LEFT JOIN "GE78BG0000000893486000_BOG_GEL" d
          ON d.raw_record_uuid = r.uuid
        WHERE d.raw_record_uuid IS NULL
      ) AS missing_in_deconsolidated;
  `;

  const res = await client.query(query);
  console.log(JSON.stringify(res.rows[0], null, 2));
  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
