const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function applySalaryAccrualsMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('📋 Reading migration file...');
    const sql = fs.readFileSync('migrations/create-salary-accruals-table.sql', 'utf8');

    console.log('🚀 Applying salary_accruals table migration...');
    await pool.query(sql);

    console.log('✅ Migration applied successfully!');
    
    // Verify table creation
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'salary_accruals'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Created table structure:');
    console.log('Column Name                 | Type              | Nullable');
    console.log('-'.repeat(70));
    result.rows.forEach(row => {
      console.log(
        `${row.column_name.padEnd(28)}| ${row.data_type.padEnd(18)}| ${row.is_nullable}`
      );
    });

    // Check indexes
    const indexes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'salary_accruals'
      ORDER BY indexname;
    `);

    console.log('\n🔑 Created indexes:');
    indexes.rows.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applySalaryAccrualsMigration();
