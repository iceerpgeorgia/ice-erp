/**
 * Setup script: register BOG account GE43BG0000000609494201 (GEL + USD)
 * in the bank_accounts table so the daily cron picks it up.
 *
 * Prerequisites:
 *   1. Run create-bog-609494201-tables.sql in the Supabase SQL editor first.
 *   2. Have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env.local
 *
 * Usage:
 *   node _setup_609494201_accounts.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const ACCOUNT_NUMBER = 'GE43BG0000000609494201';
const CURRENCIES = ['GEL', 'USD'];

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== BOG Account Setup: GE43BG0000000609494201 ===\n');

  // 1. Resolve BOG bank UUID
  const { data: bogBank, error: bankErr } = await supabase
    .from('banks')
    .select('uuid, bank_name')
    .eq('bank_name', 'BOG')
    .maybeSingle();

  if (bankErr) { console.error('Error fetching BOG bank:', bankErr.message); process.exit(1); }
  if (!bogBank) { console.error('BOG bank not found in banks table. Please create it first.'); process.exit(1); }
  console.log(`✓ BOG bank UUID: ${bogBank.uuid}`);

  // 2. Resolve currency UUIDs
  const { data: currencies, error: currErr } = await supabase
    .from('currencies')
    .select('uuid, code')
    .in('code', CURRENCIES);

  if (currErr) { console.error('Error fetching currencies:', currErr.message); process.exit(1); }

  const currencyMap = {};
  for (const c of currencies || []) {
    currencyMap[c.code.trim().toUpperCase()] = c.uuid;
  }

  for (const code of CURRENCIES) {
    if (!currencyMap[code]) {
      console.error(`Currency ${code} not found in currencies table.`);
      process.exit(1);
    }
    console.log(`✓ ${code} currency UUID: ${currencyMap[code]}`);
  }

  // 3. Check existing bank accounts and insert missing ones
  const { data: existing, error: existErr } = await supabase
    .from('bank_accounts')
    .select('uuid, account_number, currency_uuid')
    .eq('account_number', ACCOUNT_NUMBER)
    .eq('bank_uuid', bogBank.uuid);

  if (existErr) { console.error('Error checking existing accounts:', existErr.message); process.exit(1); }

  const existingCurrencies = new Set((existing || []).map(row => {
    const matchCode = Object.entries(currencyMap).find(([, uuid]) => uuid === row.currency_uuid);
    return matchCode ? matchCode[0] : null;
  }).filter(Boolean));

  console.log('\n--- Existing accounts ---');
  if (existing && existing.length > 0) {
    for (const row of existing) {
      console.log(`  ${row.account_number} uuid=${row.uuid} currency_uuid=${row.currency_uuid}`);
    }
  } else {
    console.log('  (none)');
  }

  console.log('\n--- Inserting missing accounts ---');
  for (const code of CURRENCIES) {
    if (existingCurrencies.has(code)) {
      console.log(`  SKIP ${ACCOUNT_NUMBER} ${code} (already exists)`);
      continue;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('bank_accounts')
      .insert({
        account_number: ACCOUNT_NUMBER,
        currency_uuid: currencyMap[code],
        bank_uuid: bogBank.uuid,
        is_active: true,
      })
      .select('uuid, account_number, currency_uuid')
      .single();

    if (insertErr) {
      console.error(`  ERROR inserting ${ACCOUNT_NUMBER} ${code}:`, insertErr.message);
    } else {
      console.log(`  ✓ Inserted ${ACCOUNT_NUMBER} ${code} → uuid=${inserted.uuid}`);
    }
  }

  console.log('\n=== Setup complete ===');
  console.log('The daily cron at /api/cron/bog-import-last-3-days will now include this account.');
  console.log('To trigger an immediate import, call that endpoint with a valid CRON_SECRET.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
