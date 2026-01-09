const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSql(sql, description) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.error(`❌ ${description} failed:`, error);
      throw error;
    }
    console.log(`✓ ${description}`);
    return data;
  } catch (err) {
    // If RPC doesn't exist, we'll need to use direct SQL
    console.log(`Note: Using direct approach for ${description}`);
    throw err;
  }
}

async function main() {
  try {
    console.log('Connecting to Supabase...');
    console.log('Dropping old parsing tables...');
    
    // Drop old tables
    await supabase.rpc('exec_sql', { 
      sql_query: 'DROP TABLE IF EXISTS "bank_accounts_parsing_rules" CASCADE' 
    }).catch(() => console.log('Table bank_accounts_parsing_rules does not exist or already dropped'));
    
    await supabase.rpc('exec_sql', { 
      sql_query: 'DROP TABLE IF EXISTS "parsing_schemes" CASCADE' 
    }).catch(() => console.log('Table parsing_schemes does not exist or already dropped'));
    
    console.log('✓ Old tables dropped');
    
    // Remove parsing_scheme_id column from bank_accounts if exists
    await supabase.rpc('exec_sql', { 
      sql_query: 'ALTER TABLE "bank_accounts" DROP COLUMN IF EXISTS "parsing_scheme_id"' 
    }).catch(() => console.log('Column parsing_scheme_id does not exist'));
    
    console.log('✓ Removed parsing_scheme_id from bank_accounts');
    
    console.log('Creating new parsing_schemes table...');
    await supabase.rpc('exec_sql', { 
      sql_query: `CREATE TABLE "parsing_schemes" (
        "scheme" VARCHAR(50) NOT NULL PRIMARY KEY,
        "uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()
      )` 
    });
    console.log('✓ parsing_schemes table created');
    
    console.log('Creating parsing_scheme_rules table...');
    await supabase.rpc('exec_sql', { 
      sql_query: `CREATE TABLE "parsing_scheme_rules" (
        "id" BIGSERIAL PRIMARY KEY,
        "scheme_uuid" UUID NOT NULL REFERENCES "parsing_schemes"("uuid") ON DELETE CASCADE,
        "column_name" VARCHAR(100) NOT NULL,
        "condition" TEXT NOT NULL,
        "payment_id" VARCHAR(255) NOT NULL
      )` 
    });
    console.log('✓ parsing_scheme_rules table created');
    
    console.log('Creating indexes...');
    await supabase.rpc('exec_sql', { 
      sql_query: 'CREATE INDEX "parsing_scheme_rules_scheme_uuid_idx" ON "parsing_scheme_rules"("scheme_uuid")' 
    });
    console.log('✓ Indexes created');
    
    console.log('Inserting default schemes...');
    await supabase.rpc('exec_sql', { 
      sql_query: `INSERT INTO "parsing_schemes" ("scheme") VALUES 
        ('BOG_GEL'),
        ('BOG_FX'),
        ('TBC_GEL'),
        ('TBC_FX')` 
    });
    console.log('✓ 4 default schemes inserted: BOG_GEL, BOG_FX, TBC_GEL, TBC_FX');
    
    console.log('\n✅ Supabase migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\nNote: If exec_sql RPC does not exist, you need to run these SQL commands manually in Supabase SQL Editor:');
    console.log(`
-- Drop old tables
DROP TABLE IF EXISTS "bank_accounts_parsing_rules" CASCADE;
DROP TABLE IF EXISTS "parsing_schemes" CASCADE;
ALTER TABLE "bank_accounts" DROP COLUMN IF EXISTS "parsing_scheme_id";

-- Create parsing_schemes table
CREATE TABLE "parsing_schemes" (
  "scheme" VARCHAR(50) NOT NULL PRIMARY KEY,
  "uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()
);

-- Create parsing_scheme_rules table
CREATE TABLE "parsing_scheme_rules" (
  "id" BIGSERIAL PRIMARY KEY,
  "scheme_uuid" UUID NOT NULL REFERENCES "parsing_schemes"("uuid") ON DELETE CASCADE,
  "column_name" VARCHAR(100) NOT NULL,
  "condition" TEXT NOT NULL,
  "payment_id" VARCHAR(255) NOT NULL
);

-- Create index
CREATE INDEX "parsing_scheme_rules_scheme_uuid_idx" ON "parsing_scheme_rules"("scheme_uuid");

-- Insert default schemes
INSERT INTO "parsing_schemes" ("scheme") VALUES 
  ('BOG_GEL'),
  ('BOG_FX'),
  ('TBC_GEL'),
  ('TBC_FX');
    `);
    process.exit(1);
  }
}

main();
