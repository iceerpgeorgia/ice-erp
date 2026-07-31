#!/usr/bin/env node
/**
 * Execute BOG USD Import via Prisma & DATABASE_URL
 * Uses Prisma client which already connects successfully
 */

// First, manually set DATABASE_URL before Prisma loads
const fs = require('fs');
const path = require('path');

// Parse .env.local directly to get clean DATABASE_URL
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);

if (dbUrlMatch) {
  let dbUrl = dbUrlMatch[1];
  // Remove surrounding quotes if present
  dbUrl = dbUrl.replace(/^["']|["']$/g, '');
  // Set it in process.env
  process.env.DATABASE_URL = dbUrl;
}

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function executeImport() {
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
    
    // Execute the full SQL file using Prisma's raw query
    await prisma.$executeRawUnsafe(sql);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ IMPORT COMPLETED in ${duration} seconds\n`);
    
    // Verify import
    console.log('📊 Verifying import results...\n');
    
    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as total_rows FROM "GE78BG0000000893486000_BOG_USD"`
    );
    console.log(`Total rows in table: ${countResult[0].total_rows}`);
    
    const dateResult = await prisma.$queryRawUnsafe(`
      SELECT 
        MIN(transaction_date) as earliest,
        MAX(transaction_date) as latest,
        COUNT(DISTINCT operation_id) as unique_operations
      FROM "GE78BG0000000893486000_BOG_USD"
      WHERE transaction_date IS NOT NULL
    `);
    
    const dates = dateResult[0];
    console.log(`Date range: ${dates.earliest} to ${dates.latest}`);
    console.log(`Unique operation IDs: ${dates.unique_operations}`);
    
    const duplicateResult = await prisma.$queryRawUnsafe(`
      SELECT operation_id, COUNT(*) as occurrences
      FROM "GE78BG0000000893486000_BOG_USD"
      WHERE operation_id IS NOT NULL
      GROUP BY operation_id
      HAVING COUNT(*) > 1
    `);
    
    console.log(`Duplicate operation IDs: ${duplicateResult.length}`);
    
    console.log('\n' + '='.repeat(100));
    console.log('✅ SUCCESS - BOG USD transactions imported and verified');
    console.log('='.repeat(100) + '\n');
    
  } catch (error) {
    console.error('\n❌ IMPORT FAILED\n');
    console.error('Error:', error.message);
    if (error.meta?.cause) console.error('Cause:', error.meta.cause);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

executeImport();
