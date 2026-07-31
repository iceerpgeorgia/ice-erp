#!/usr/bin/env node
/**
 * BOG USD Transaction Import - Direct Database Connection
 * Uses Node.js pg package to execute SQL import
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('BOG USD TRANSACTION IMPORT - DIRECT DATABASE CONNECTION');
  console.log('='.repeat(100) + '\n');

  // Parse DATABASE_URL from .env.local
  const envFile = fs.readFileSync('.env.local', 'utf-8');
  const dbUrlMatch = envFile.match(/DATABASE_URL="([^"]+)"/);

  if (!dbUrlMatch) {
    console.error('❌ DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  const connectionString = dbUrlMatch[1];
  const dbHost = connectionString.split('@')[1].split(':')[0];
  
  console.log(`📍 Target Database: ${dbHost}`);
  console.log(`📁 SQL Script: _bog_usd_import.sql`);

  // Read SQL script
  const sqlFile = path.join(__dirname, '_bog_usd_import.sql');
  if (!fs.existsSync(sqlFile)) {
    console.error(`❌ SQL file not found: ${sqlFile}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFile, 'utf-8');
  console.log(`✓ SQL script loaded: ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Create connection pool
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    // Connect
    const client = await pool.connect();
    console.log('✓ Connected to database\n');

    // Get initial row count
    console.log('📊 Getting initial row count...');
    const initialCountResult = await client.query(
      'SELECT COUNT(*) as count FROM "GE78BG0000000893486000_BOG_USD"'
    );
    const initialCount = parseInt(initialCountResult.rows[0].count);
    console.log(`   Initial rows: ${initialCount.toLocaleString()}\n`);

    // Execute import
    console.log('📝 Executing import...\n');
    console.log('   Inserting 3,660 transactions with deduplication...\n');

    // Split into smaller chunks to avoid timeout
    const sqlStatements = sqlContent
      .split(';\n')
      .filter(s => s.trim().startsWith('INSERT'));

    let totalInserted = 0;

    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i].trim();
      if (!statement) continue;

      try {
        // Execute with progress indicator
        if ((i + 1) % 1 === 0) {
          process.stdout.write(
            `   [${((i + 1) / sqlStatements.length * 100).toFixed(0)}%] Processing statement ${i + 1}/${sqlStatements.length}...\r`
          );
        }

        const result = await client.query(statement);
        totalInserted += result.rowCount || 0;
      } catch (err) {
        console.error(`\n   ⚠️  Statement ${i + 1} error: ${err.message}`);
        // Continue with next statement
      }
    }

    console.log(
      `   [100%] Processing statement ${sqlStatements.length}/${sqlStatements.length}... ✓\n`
    );

    // Get final row count
    console.log('✓ Verifying import...\n');
    const finalCountResult = await client.query(
      'SELECT COUNT(*) as count FROM "GE78BG0000000893486000_BOG_USD"'
    );
    const finalCount = parseInt(finalCountResult.rows[0].count);
    const newRows = finalCount - initialCount;

    console.log(`   Initial rows: ${initialCount.toLocaleString()}`);
    console.log(`   Final rows: ${finalCount.toLocaleString()}`);
    console.log(`   New rows added: ${newRows.toLocaleString()}\n`);

    // Get detailed statistics
    const statsResult = await client.query(`
      SELECT
        COUNT(*) as total_rows,
        COUNT(DISTINCT operation_id) as unique_operations,
        MIN(transaction_date) as earliest_date,
        MAX(transaction_date) as latest_date,
        COUNT(CASE WHEN transaction_date IS NULL THEN 1 END) as null_dates,
        COUNT(CASE WHEN debit_amount IS NOT NULL THEN 1 END) as debit_transactions,
        COUNT(CASE WHEN credit_amount IS NOT NULL THEN 1 END) as credit_transactions
      FROM "GE78BG0000000893486000_BOG_USD"
      WHERE transaction_date >= '2018-01-01'
    `);

    const stats = statsResult.rows[0];
    
    console.log('📊 IMPORT STATISTICS:\n');
    console.log(`   Total rows in table: ${parseInt(stats.total_rows).toLocaleString()}`);
    console.log(`   Unique operation IDs: ${parseInt(stats.unique_operations).toLocaleString()}`);
    console.log(`   Unique debit transactions: ${parseInt(stats.debit_transactions).toLocaleString()}`);
    console.log(`   Unique credit transactions: ${parseInt(stats.credit_transactions).toLocaleString()}`);
    console.log(`   Date range: ${stats.earliest_date} to ${stats.latest_date}`);
    console.log(`   NULL dates: ${parseInt(stats.null_dates)}\n`);

    // Sample data check
    console.log('🔍 SAMPLE DATA VERIFICATION:\n');
    const sampleResult = await client.query(`
      SELECT
        transaction_date,
        document_number,
        operation_id,
        debit_amount,
        credit_amount,
        amount,
        operation_description
      FROM "GE78BG0000000893486000_BOG_USD"
      WHERE operation_id IN (22705799177, 22706498189, 22706498199)
      LIMIT 3
    `);

    sampleResult.rows.forEach((row, idx) => {
      console.log(`   Sample ${idx + 1}:`);
      console.log(`     Date: ${row.transaction_date}`);
      console.log(`     Document: ${row.document_number}`);
      console.log(`     Operation ID: ${row.operation_id}`);
      console.log(`     Amount: ${row.amount} (Debit: ${row.debit_amount}, Credit: ${row.credit_amount})`);
      console.log(`     Description: ${row.operation_description?.substring(0, 60)}...\n`);
    });

    client.release();

    console.log('='.repeat(100));
    if (newRows > 0) {
      console.log(`✅ IMPORT SUCCESSFUL - ${newRows.toLocaleString()} new transactions added`);
    } else {
      console.log('⚠️  IMPORT COMPLETED - No new transactions added (duplicates skipped)');
    }
    console.log('='.repeat(100) + '\n');

  } catch (error) {
    console.error('\n' + '='.repeat(100));
    console.error('❌ IMPORT FAILED');
    console.error('='.repeat(100));
    console.error(`Error: ${error.message}\n`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
