/**
 * Enable Row Level Security (RLS) on all public tables
 * 
 * This script addresses the critical security issue identified in Supabase
 * where 30 tables are exposed without RLS policies.
 * 
 * WARNING: This creates permissive policies for authenticated users.
 * You should refine these policies based on your actual security requirements.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// All tables that need RLS enabled
const tables = [
  '_prisma_migrations',
  'VerificationToken',
  'entity_types',
  'counteragents',
  'Account',
  'Session',
  'project_employees',
  'countries',
  'consolidated_bank_accounts',
  'payments_ledger',
  'currencies',
  'nbg_exchange_rates',
  'User',
  'project_states',
  'payments',
  'AuditLog',
  'bank_transaction_batches',
  'projects',
  'counteragents_audit',
  'bank_accounts',
  'salary_accruals',
  'financial_codes',
  'banks',
  'brands',
  'jobs',
  'payment_id_duplicates',
  'parsing_scheme_rules',
  'bog_gel_raw_893486000',
  'parsing_schemes'
];

async function enableRLSOnTable(tableName) {
  try {
    // Enable RLS
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY;
    `);
    console.log(`✅ Enabled RLS on ${tableName}`);
    
    // Create permissive policy for authenticated users
    // NOTE: Adjust these policies based on your actual security requirements!
    try {
      await prisma.$executeRawUnsafe(`
        CREATE POLICY "authenticated_all_${tableName}"
          ON public."${tableName}"
          FOR ALL
          TO authenticated
          USING (true)
          WITH CHECK (true);
      `);
      console.log(`✅ Created policy on ${tableName}`);
    } catch (policyError) {
      // Policy might already exist
      if (policyError.message.includes('already exists')) {
        console.log(`⚠️  Policy already exists on ${tableName}`);
      } else {
        console.error(`❌ Failed to create policy on ${tableName}:`, policyError.message);
      }
    }
    
    return { table: tableName, success: true };
  } catch (error) {
    console.error(`❌ Failed on ${tableName}:`, error.message);
    return { table: tableName, success: false, error: error.message };
  }
}

async function main() {
  console.log('🔐 Enabling Row Level Security on all tables...\n');
  console.log('⚠️  WARNING: This creates PERMISSIVE policies for all authenticated users.');
  console.log('   Review and tighten these policies for production use!\n');
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const table of tables) {
    const result = await enableRLSOnTable(table);
    if (result.success) {
      results.success.push(table);
    } else {
      results.failed.push({ table, error: result.error });
    }
    
    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully enabled RLS on ${results.success.length} tables`);
  console.log(`❌ Failed on ${results.failed.length} tables`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed tables:');
    results.failed.forEach(({ table, error }) => {
      console.log(`  - ${table}: ${error}`);
    });
  }
  
  console.log('\n⚠️  IMPORTANT NEXT STEPS:');
  console.log('1. Review the policies created (they are VERY permissive)');
  console.log('2. Tighten policies based on your security requirements');
  console.log('3. Test API access to ensure data is still accessible');
  console.log('4. Check Supabase dashboard - security issues should drop from 60 to ~30');
  console.log('\nExample of more restrictive policy:');
  console.log(`
    -- Only allow users to see their own data
    DROP POLICY IF EXISTS "authenticated_all_payments" ON public.payments;
    CREATE POLICY "users_own_payments"
      ON public.payments
      FOR SELECT
      TO authenticated
      USING (user_uuid = auth.uid());
  `);
}

main()
  .then(() => {
    console.log('\n✅ RLS enablement complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
