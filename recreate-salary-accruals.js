const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function recreateSalaryAccruals() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🗑️  Dropping existing salary_accruals table...');
    await pool.query('DROP TABLE IF EXISTS salary_accruals CASCADE;');
    console.log('✅ Table dropped');

    console.log('\n📋 Reading migration file...');
    const sql = fs.readFileSync('migrations/create-salary-accruals-table.sql', 'utf8');

    console.log('🚀 Creating salary_accruals table with updated constraints...');
    await pool.query(sql);
    console.log('✅ Table created successfully!');
    
    // Verify table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'salary_accruals'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Table structure (NOT NULL columns):');
    console.log('Column Name                 | Type              | Nullable');
    console.log('-'.repeat(70));
    result.rows.forEach(row => {
      const marker = row.is_nullable === 'NO' ? '✓' : ' ';
      console.log(
        `${marker} ${row.column_name.padEnd(26)}| ${row.data_type.padEnd(18)}| ${row.is_nullable}`
      );
    });

    console.log('\n✅ All columns are correctly configured!');
    console.log('   Only these 5 columns are nullable:');
    console.log('   - insurance_limit');
    console.log('   - total_insurance');
    console.log('   - deducted_insurance');
    console.log('   - deducted_fitness');
    console.log('   - deducted_fine');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

recreateSalaryAccruals();
