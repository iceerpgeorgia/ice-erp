const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyTriggers() {
  try {
    console.log('🔍 Verifying database triggers and functions...\n');
    
    // Check all trigger functions exist
    console.log('📦 Checking trigger functions:');
    const functions = await prisma.$queryRaw`
      SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname LIKE '%project%'
      ORDER BY p.proname
    `;
    
    const expectedFunctions = [
      'populate_project_counteragent',
      'populate_project_financial_code',
      'populate_project_currency',
      'populate_project_state',
      'populate_project_contract_no',
      'populate_project_index',
      'update_projects_on_counteragent_change',
      'update_projects_on_financial_code_change',
      'update_projects_on_currency_change',
      'update_projects_on_state_change'
    ];
    
    const foundFunctions = functions.map(f => f.function_name);
    
    expectedFunctions.forEach(fname => {
      const found = foundFunctions.includes(fname);
      console.log(`  ${found ? '✓' : '✗'} ${fname}`);
    });
    
    console.log('');
    console.log('🎯 Checking triggers on projects table:');
    const projectTriggers = await prisma.$queryRaw`
      SELECT 
        tgname as trigger_name,
        tgtype,
        CASE 
          WHEN tgtype & 2 = 2 THEN 'BEFORE'
          WHEN tgtype & 4 = 4 THEN 'AFTER'
          ELSE 'UNKNOWN'
        END as timing,
        CASE
          WHEN tgtype & 4 = 4 THEN 'INSERT'
          WHEN tgtype & 8 = 8 THEN 'DELETE'
          WHEN tgtype & 16 = 16 THEN 'UPDATE'
          ELSE 'UNKNOWN'
        END as event
      FROM pg_trigger
      WHERE tgrelid = 'projects'::regclass
      AND tgname NOT LIKE 'RI_%' -- Exclude foreign key triggers
      ORDER BY tgname
    `;
    
    projectTriggers.forEach(t => {
      console.log(`  ✓ ${t.trigger_name} (${t.timing} ${t.event})`);
    });
    
    console.log('');
    console.log('🔗 Checking triggers on related tables:');
    
    const relatedTables = ['counteragents', 'financial_codes', 'currencies', 'project_states'];
    
    for (const table of relatedTables) {
      const triggers = await prisma.$queryRaw`
        SELECT tgname as trigger_name
        FROM pg_trigger
        WHERE tgrelid = ${table}::regclass
        AND tgname LIKE '%project%'
      `;
      
      if (triggers.length > 0) {
        triggers.forEach(t => {
          console.log(`  ✓ ${table}.${t.trigger_name}`);
        });
      } else {
        console.log(`  ⚠️  ${table} - no project-related triggers found`);
      }
    }
    
    console.log('');
    console.log('📊 Checking computed columns in projects table:');
    const columns = await prisma.$queryRaw`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        col_description('projects'::regclass, ordinal_position) as description
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name IN ('counteragent', 'financial_code', 'currency', 'state', 'contract_no', 'project_index')
      ORDER BY column_name
    `;
    
    columns.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
      if (col.description) {
        console.log(`    ${col.description}`);
      }
    });
    
    console.log('');
    console.log('✅ Verification complete!');
    console.log('');
    console.log('Summary:');
    console.log(`  - ${foundFunctions.length} trigger functions created`);
    console.log(`  - ${projectTriggers.length} triggers on projects table`);
    console.log(`  - ${columns.length} computed columns added`);
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error('');
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTriggers();
