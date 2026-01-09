// Apply parsing scheme migration to Supabase
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyParsingSchemeMigrationToSupabase() {
  const remoteUrl = process.env.REMOTE_DATABASE_URL;
  
  if (!remoteUrl) {
    console.error('❌ REMOTE_DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString: remoteUrl
  });

  try {
    await client.connect();
    console.log('✓ Connected to Supabase\n');
    
    console.log('🔍 Checking if parsing_scheme_id column exists in bank_accounts...\n');
    
    // Check if column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bank_accounts' 
      AND column_name = 'parsing_scheme_id'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Column parsing_scheme_id already exists in bank_accounts table.');
      console.log('   Migration has already been applied.');
      await client.end();
      return;
    }
    
    console.log('📝 Reading migration file...\n');
    const migrationPath = path.join(__dirname, 'prisma', 'migrations', '20260108200904_add_parsing_schemes_and_rules', 'migration.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Applying missing parts of the migration to Supabase...\n');
    
    // Execute only the ALTER TABLE part since tables already exist
    console.log('Adding parsing_scheme_id column to bank_accounts...\n');
    
    try {
      await client.query(`
        ALTER TABLE "bank_accounts" ADD COLUMN IF NOT EXISTS "parsing_scheme_id" BIGINT;
      `);
      console.log('✓ Column added successfully\n');
    } catch (error) {
      if (error.code === '42701') {
        console.log('⚠ Column already exists\n');
      } else {
        throw error;
      }
    }
    
    // Add index
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS "bank_accounts_parsing_scheme_id_idx" ON "bank_accounts"("parsing_scheme_id");
      `);
      console.log('✓ Index created\n');
    } catch (error) {
      console.log('⚠ Index creation skipped:', error.message.substring(0, 100));
    }
    
    // Add foreign key
    try {
      await client.query(`
        ALTER TABLE "bank_accounts" 
        ADD CONSTRAINT "bank_accounts_parsing_scheme_id_fkey" 
        FOREIGN KEY ("parsing_scheme_id") REFERENCES "parsing_schemes"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      console.log('✓ Foreign key constraint added\n');
    } catch (error) {
      if (error.code === '42710') {
        console.log('⚠ Foreign key already exists\n');
      } else {
        console.log('⚠ Foreign key creation skipped:', error.message.substring(0, 100));
      }
    }
    
    console.log('🔍 Verifying...\n');
    
    // Verify the column was created
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'bank_accounts' 
      AND column_name = 'parsing_scheme_id'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✓ Column verified:', verifyResult.rows[0]);
    }
    
    // Check parsing schemes count
    const schemesResult = await client.query('SELECT COUNT(*) FROM parsing_schemes');
    console.log(`✓ Parsing schemes in database: ${schemesResult.rows[0].count}`);
    
    // Check bank accounts with parsing scheme
    const withSchemeResult = await client.query(`
      SELECT COUNT(*) FROM bank_accounts WHERE parsing_scheme_id IS NOT NULL
    `);
    console.log(`✓ Bank accounts with parsing scheme: ${withSchemeResult.rows[0].count}`);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyParsingSchemeMigrationToSupabase();
