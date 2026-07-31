#!/usr/bin/env node
/**
 * BOG USD Import Executor
 * 
 * Usage:
 *   node _import_bog_usd_final.js
 * 
 * Environment Requirements:
 *   - DATABASE_URL must be set (from .env.local or environment)
 *   - Must have network access to Supabase
 *   - Node.js v18+ with Prisma installed
 * 
 * What it does:
 *   1. Reads _bog_usd_import.sql (1.67 MB, 3,660 transactions)
 *   2. Executes via Prisma to GE78BG0000000893486000_BOG_USD table
 *   3. Verifies import with row count, date range, and deduplication checks
 */

const fs = require('fs');
const path = require('path');

// Parse .env.local before requiring Prisma
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  lines.forEach(line => {
    if (line.startsWith('DATABASE_URL=')) {
      let value = line.substring('DATABASE_URL='.length);
      // Remove quotes
      value = value.replace(/^["']|["']$/g, '');
      process.env.DATABASE_URL = value;
    }
  });
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function executeImport() {
  try {
    console.log('\n' + '='.repeat(100));
    console.log('🚀 BOG USD IMPORT - FINAL EXECUTION');
    console.log('='.repeat(100) + '\n');
    
    console.log('📄 Loading SQL file...');
    const sqlPath = path.join(__dirname, '_bog_usd_import.sql');
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found: ${sqlPath}`);
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const fileSizeMB = (sql.length / 1024 / 1024).toFixed(2);
    console.log(`✓ Loaded ${fileSizeMB} MB\n`);
    
    console.log('📊 SQL Summary:');
    const lineCount = sql.split('\n').length;
    const insertCount = (sql.match(/INSERT INTO/g) || []).length;
    console.log(`   - Total lines: ${lineCount.toLocaleString()}`);
    console.log(`   - INSERT statements: ${insertCount.toLocaleString()}`);
    console.log(`   - Date range: 2018-01-12 to 2022-04-18`);
    console.log(`   - Target table: GE78BG0000000893486000_BOG_USD\n`);
    
    console.log('⏳ Executing SQL import...');
    console.log('   (This may take 3-5 minutes)\n');
    
    const startTime = Date.now();
    
    // Execute the full SQL file
    await prisma.$executeRawUnsafe(sql);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`✅ IMPORT COMPLETED in ${duration} seconds\n`);
    
    // Verify import results
    console.log('📊 VERIFICATION RESULTS:\n');
    
    // Total row count
    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as total_rows FROM "GE78BG0000000893486000_BOG_USD"`
    );
    const totalRows = countResult[0].total_rows;
    console.log(`Total rows in table: ${totalRows.toLocaleString()}`);
    
    // Date range and unique operation IDs
    const dateResult = await prisma.$queryRawUnsafe(`
      SELECT 
        MIN(transaction_date) as earliest,
        MAX(transaction_date) as latest,
        COUNT(DISTINCT operation_id) as unique_operations
      FROM "GE78BG0000000893486000_BOG_USD"
      WHERE transaction_date IS NOT NULL
    `);
    
    const { earliest, latest, unique_operations } = dateResult[0];
    console.log(`Date range: ${earliest} to ${latest}`);
    console.log(`Unique operation IDs: ${unique_operations.toLocaleString()}`);
    
    // Check for duplicates
    const duplicateResult = await prisma.$queryRawUnsafe(`
      SELECT operation_id, COUNT(*) as count
      FROM "GE78BG0000000893486000_BOG_USD"
      WHERE operation_id IS NOT NULL
      GROUP BY operation_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log(`Duplicate operation IDs found: ${duplicateResult.length}`);
    if (duplicateResult.length > 0) {
      console.log(`   Top duplicates:`);
      duplicateResult.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.operation_id}: ${row.count} occurrences`);
      });
    }
    
    // Sample row
    console.log(`\nSample record from table:`);
    const sampleResult = await prisma.$queryRawUnsafe(`
      SELECT 
        transaction_date,
        document_number,
        operation_id,
        amount_gel,
        operation_description
      FROM "GE78BG0000000893486000_BOG_USD"
      LIMIT 1
    `);
    
    if (sampleResult.length > 0) {
      const sample = sampleResult[0];
      console.log(`   Date: ${sample.transaction_date}`);
      console.log(`   Doc: ${sample.document_number}`);
      console.log(`   Op ID: ${sample.operation_id}`);
      console.log(`   Amount: ${sample.amount_gel}`);
      console.log(`   Desc: ${sample.operation_description?.substring(0, 50)}...`);
    }
    
    console.log('\n' + '='.repeat(100));
    console.log('✅ SUCCESS - BOG USD transactions imported and verified');
    console.log('='.repeat(100) + '\n');
    
    // Summary
    console.log('📋 IMPORT SUMMARY:');
    console.log(`   • Total rows imported: ${totalRows.toLocaleString()}`);
    console.log(`   • Expected: 3,660 (or close if duplicates pre-existed)`);
    console.log(`   • Duration: ${duration} seconds`);
    console.log(`   • Date range: ${earliest} to ${latest}`);
    console.log(`   • Table: GE78BG0000000893486000_BOG_USD\n`);
    
    return true;
    
  } catch (error) {
    console.error('\n❌ IMPORT FAILED\n');
    console.error('Error:', error.message);
    
    if (error.message.includes('Can\'t reach database server')) {
      console.error('\n⚠️  NETWORK ERROR: Cannot reach Supabase database');
      console.error('   This script must be run from a machine with internet access');
      console.error('   Options:');
      console.error('   1. Run from your local machine with internet');
      console.error('   2. Run from Vercel deployment environment');
      console.error('   3. Execute SQL via Supabase console directly');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run import
executeImport();
