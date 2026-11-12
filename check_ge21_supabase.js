require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '***' : 'missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkGe21() {
  try {
    console.log('=== GE21 Account Status (via Supabase) ===\n');

    // Query 1: Check GE21 account metadata
    console.log('1. Fetching GE21 Account Metadata...');
    const { data: ge21Account, error: error1 } = await supabase
      .from('bank_accounts')
      .select('uuid, account_number, raw_table_name, is_active, insider_uuid, currency_uuid')
      .eq('account_number', 'GE21BG0000000611354669');

    if (error1) {
      console.error('   Error:', error1.message);
    } else {
      console.log('   Found:', ge21Account.length, 'record(s)');
      if (ge21Account.length > 0) {
        const account = ge21Account[0];
        console.log({
          account_number: account.account_number,
          raw_table_name: account.raw_table_name,
          is_active: account.is_active,
          insider_uuid: account.insider_uuid
        });
      }
    }

    // Query 2: Check if GE21 raw table exists
    console.log('\n2. Checking if GE21 raw table exists...');
    if (ge21Account.length > 0 && ge21Account[0].raw_table_name) {
      const tableName = ge21Account[0].raw_table_name;
      const { count, error: error2 } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (error2) {
        if (error2.message.includes('Could not find the table')) {
          console.log(`   ✗ Table "${tableName}" DOES NOT EXIST`);
          console.log('   Error:', error2.message);
        } else {
          console.log('   Error:', error2.message);
        }
      } else {
        console.log(`   ✓ Table "${tableName}" exists`);
        console.log(`   Row count: ${count}`);
      }
    } else {
      console.log('   Cannot check: raw_table_name is NULL or account not found');
    }

    // Query 3: List all active accounts
    console.log('\n3. Fetching all active accounts...');
    const { data: allAccounts, error: error3 } = await supabase
      .from('bank_accounts')
      .select('account_number, raw_table_name, is_active, insider_uuid')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (error3) {
      console.error('   Error:', error3.message);
    } else {
      console.log(`   Total active accounts: ${allAccounts.length}`);
      const ge21Active = allAccounts.find((a) => a.account_number === 'GE21BG0000000611354669');
      if (ge21Active) {
        console.log('   ✓ GE21 is in the active accounts list');
        console.log(`     - raw_table_name: ${ge21Active.raw_table_name}`);
        console.log(`     - insider_uuid: ${ge21Active.insider_uuid}`);
      } else {
        console.log('   ✗ GE21 is NOT in the active accounts list');
      }

      // Show first few accounts for context
      console.log('\n   Sample of active accounts:');
      allAccounts.slice(0, 3).forEach((a) => {
        console.log(`     - ${a.account_number}: ${a.raw_table_name}`);
      });
    }

    // Query 4: Check the counteragent_uuid field (if exists) for GE21
    console.log('\n4. Verifying insider UUID alignment...');
    if (ge21Account.length > 0) {
      const primaryInsider = allAccounts.find((a) => a.insider_uuid);
      console.log(`   GE21 insider_uuid: ${ge21Account[0].insider_uuid}`);
      console.log(`   Dominant insider (from active accounts): ${primaryInsider?.insider_uuid}`);
      if (ge21Account[0].insider_uuid === primaryInsider?.insider_uuid) {
        console.log('   ✓ Insider UUIDs match');
      } else {
        console.log('   ⚠ Insider UUIDs differ');
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

checkGe21();
