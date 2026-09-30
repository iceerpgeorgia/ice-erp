#!/usr/bin/env node

/**
 * Database Recovery Diagnostic Script
 * Run this to check your Supabase database status
 */

const fs = require('fs');
const path = require('path');

console.log('\n=== SUPABASE DATABASE RECOVERY DIAGNOSTIC ===\n');

// 1. Check .env.local
console.log('1. Checking .env.local configuration...');
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const hasDbUrl = envContent.includes('DATABASE_URL=') && !envContent.includes('DATABASE_URL=""');
  const hasDirectUrl = envContent.includes('DIRECT_DATABASE_URL=') && !envContent.includes('DIRECT_DATABASE_URL=""');
  const hasSupabaseUrl = envContent.includes('NEXT_PUBLIC_SUPABASE_URL=');
  
  console.log(`   ✓ .env.local exists`);
  console.log(`   ${hasDbUrl ? '✓' : '❌'} DATABASE_URL is configured`);
  console.log(`   ${hasDirectUrl ? '✓' : '❌'} DIRECT_DATABASE_URL is configured`);
  console.log(`   ${hasSupabaseUrl ? '✓' : '❌'} NEXT_PUBLIC_SUPABASE_URL is configured`);
  
  if (!hasDbUrl || !hasDirectUrl) {
    console.log('\n   ⚠️  MISSING CONNECTION STRINGS - This is likely your issue!');
  }
} else {
  console.log('   ❌ .env.local not found');
}

// 2. Check Prisma schema
console.log('\n2. Checking Prisma schema...');
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
  console.log('   ✓ schema.prisma found');
}

// 3. Count migrations
console.log('\n3. Checking migrations...');
const migrationsPath = path.join(__dirname, 'prisma', 'migrations');
if (fs.existsSync(migrationsPath)) {
  const migrations = fs.readdirSync(migrationsPath).filter(f => !f.startsWith('.'));
  console.log(`   ✓ Found ${migrations.length} migration(s)`);
  console.log('   Latest migrations:');
  migrations.slice(-5).forEach(m => console.log(`     - ${m}`));
}

console.log('\n=== NEXT STEPS ===\n');
console.log('1. Go to https://app.supabase.com');
console.log('2. Select your project (fojbzghphznbslqwurrm)');
console.log('3. Check Settings → Database → Status');
console.log('4. If status is "Paused", click Resume');
console.log('5. Get connection string from Settings → Database → Connection String');
console.log('6. Update DATABASE_URL and DIRECT_DATABASE_URL in .env.local');
console.log('7. Run: npx prisma db push');
console.log('\nIf tables are still missing after reconnecting:');
console.log('   Go to Settings → Backups and restore from the latest backup');
console.log('\nSee SUPABASE_RECOVERY.md for detailed instructions\n');
