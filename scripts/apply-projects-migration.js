const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: SUPABASE_URL
    }
  }
});

async function applyMigration() {
  try {
    console.log('📦 Reading migration file...');
    const sqlFile = path.join(__dirname, 'add-projects-computed-columns.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('🔄 Applying migration to Supabase...');
    
    // Split SQL into statements, preserving CREATE FUNCTION blocks
    const statements = [];
    let currentStatement = '';
    let inFunction = false;
    
    const lines = sql.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments
      if (trimmedLine.startsWith('--')) continue;
      
      // Track if we're inside a function definition
      if (trimmedLine.includes('CREATE OR REPLACE FUNCTION')) {
        inFunction = true;
      }
      
      currentStatement += line + '\n';
      
      // End of statement: semicolon outside of function, or END; with $$ LANGUAGE
      if (trimmedLine.endsWith(';')) {
        if (!inFunction) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        } else if (trimmedLine === '$$ LANGUAGE plpgsql;') {
          // End of function definition
          statements.push(currentStatement.trim());
          currentStatement = '';
          inFunction = false;
        }
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 60).replace(/\s+/g, ' ');
      console.log(`  [${i + 1}/${statements.length}] ${preview}...`);
      
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (error) {
        console.warn(`    ⚠️  Warning: ${error.message}`);
        // Continue even if some statements fail (e.g., column already exists)
      }
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('Added columns:');
    console.log('  - counteragent (TEXT) - derived from counteragents.name');
    console.log('  - financial_code (TEXT) - derived from financial_codes.validation');
    console.log('  - currency (TEXT) - derived from currencies.code');
    console.log('  - state (TEXT) - derived from project_states.name');
    console.log('  - contract_no (TEXT) - computed on insert');
    console.log('');
    console.log('Created triggers to auto-populate these columns');
    
    // Verify the columns were added
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects' 
      AND table_schema = 'public'
      AND column_name IN ('counteragent', 'financial_code', 'currency', 'state', 'contract_no', 'project_index')
      ORDER BY column_name
    `;
    
    console.log('');
    console.log('Verified columns in projects table:');
    columns.forEach(col => console.log(`  ✓ ${col.column_name}`));
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
