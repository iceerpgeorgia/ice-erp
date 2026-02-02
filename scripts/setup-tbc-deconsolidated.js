const { Client } = require('pg');

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');
}

const rawTableOld = 'GE65TB7856036050100002_TBC_GEL';
const rawTableNew = 'tbc_gel_raw_6050100002';
const deconsolidatedTable = 'GE65TB7856036050100002_TBC_GEL';
const bogDeconsolidatedTable = 'GE78BG0000000893486000_BOG_GEL';
const accountUuid = '1ef0f05d-00cc-4c6c-a858-4d8d50069496';

const sql = `
DO $$
BEGIN
  IF to_regclass('public."${rawTableOld}"') IS NOT NULL AND to_regclass('public."${rawTableNew}"') IS NULL THEN
    ALTER TABLE "${rawTableOld}" RENAME TO "${rawTableNew}";
  END IF;

  IF to_regclass('public."${deconsolidatedTable}"') IS NULL THEN
    CREATE TABLE "${deconsolidatedTable}" (LIKE "${bogDeconsolidatedTable}" INCLUDING ALL);

    IF to_regclass('public."${deconsolidatedTable}_id_seq"') IS NULL THEN
      CREATE SEQUENCE "${deconsolidatedTable}_id_seq";
    END IF;

    ALTER TABLE "${deconsolidatedTable}" ALTER COLUMN id SET DEFAULT nextval('"${deconsolidatedTable}_id_seq"');
    ALTER SEQUENCE "${deconsolidatedTable}_id_seq" OWNED BY "${deconsolidatedTable}".id;
  END IF;
END $$;

UPDATE bank_accounts
SET raw_table_name = '${rawTableNew}'
WHERE uuid = '${accountUuid}';
`;

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('✓ TBC raw table renamed and deconsolidated table created');
}

run().catch(error => {
  console.error('Error setting up TBC tables:', error.message);
  process.exit(1);
});
