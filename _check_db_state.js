const { Client } = require('pg');

const connStr = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to database!\n');

    const tableCountResult = await client.query(
      "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log('Total tables in public schema:', tableCountResult.rows[0].table_count);

    const tablesResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    console.log('\nExisting tables:');
    if (tablesResult.rows.length === 0) {
      console.log('  (none - database is empty!)');
    } else {
      tablesResult.rows.forEach(r => console.log(' -', r.tablename));
    }

  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await client.end();
  }
}

main();
