#!/usr/bin/env node
/**
 * Execute BOG USD Import via DATABASE_URL
 * Reads .env.local, loads SQL file, executes to database
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

// Decode URL-encoded characters in the connection string
DATABASE_URL = decodeURIComponent(DATABASE_URL);

console.log('🔌 Connecting to database...');
console.log('📋 Connection String:', DATABASE_URL.replace(/:[^@]+@/, ':***@'));

const pool = new Pool({ connectionString: DATABASE_URL });

async function executeImport() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '='.repeat(100));
    console.log('🚀 BOG USD IMPORT - EXECUTING');
    console.log('='.repeat(100) + '\n');
    
    console.log('📄 Loading SQL file...');
    const sqlPath = path.join(__dirname, '_bog_usd_import.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`✓ Loaded ${(sql.length / 1024 / 1024).toFixed(2)} MB\n`);
    
    console.log('⏳ Executing SQL import (this may take 3-5 minutes)...\n');
    const startTime = Date.now();
    
    // Execute the full SQL file
    await client.query(sql);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ IMPORT COMPLETED in ${duration} seconds\n`);
    
    // Verify import
    console.log('📊 Verifying import results...\n');
    
    const countResult = await client.query(
      `SELECT COUNT(*) as total_rows FROM "GE78BG0000000893486000_BOG_USD"`
    );
    console.log(`Total rows in table: ${countResult.rows[0].total_rows}`);
    
    const dateResult = await client.query(`
      SELECT 
        MIN(transaction_date) as earliest,
        MAX(transaction_date) as latest,
        COUNT(DISTINCT operation_id) as unique_operations
      FROM "GE78BG0000000893486000_BOG_USD"
      WHERE transaction_date IS NOT NULL
    `);
    
    const dates = dateResult.rows[0];
    console.log(`Date range: ${dates.earliest} to ${dates.latest}`);
    console.log(`Unique operation IDs: ${dates.unique_operations}`);
    
    const duplicateResult = await client.query(`
      SELECT operation_id, COUNT(*) as occurrences
      FROM "GE78BG0000000893486000_BOG_USD"
      WHERE operation_id IS NOT NULL
      GROUP BY operation_id
      HAVING COUNT(*) > 1
    `);
    
    console.log(`Duplicate operation IDs: ${duplicateResult.rows.length}`);
    
    console.log('\n' + '='.repeat(100));
    console.log('✅ SUCCESS - BOG USD transactions imported and verified');
    console.log('='.repeat(100) + '\n');
    
  } catch (error) {
    console.error('\n❌ IMPORT FAILED\n');
    console.error('Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

executeImport();
