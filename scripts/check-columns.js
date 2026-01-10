const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bog_gel_raw_893486000' 
      ORDER BY ordinal_position
    `);

    console.log('\n=== ALL COLUMNS IN bog_gel_raw_893486000 ===\n');
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.column_name}`);
    });

    console.log('\n=== Columns containing "sender" ===');
    result.rows
      .filter(r => r.column_name.includes('sender'))
      .forEach(r => console.log(`  ${r.column_name}`));

    console.log('\n=== Columns containing "receiver" ===');
    result.rows
      .filter(r => r.column_name.includes('receiver'))
      .forEach(r => console.log(`  ${r.column_name}`));

    console.log('\n=== Columns containing "inn" ===');
    result.rows
      .filter(r => r.column_name.includes('inn'))
      .forEach(r => console.log(`  ${r.column_name}`));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns();
