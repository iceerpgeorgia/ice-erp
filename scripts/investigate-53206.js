require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const prisma = new PrismaClient();

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Check the raw BOG GEL table on Supabase for id=53206
  const { data: rawData, error } = await supabase
    .from('GE78BG0000000893486000_BOG_GEL')
    .select('*')
    .eq('id', 53206);

  if (error) {
    console.log('Error:', error.message);
    await prisma.$disconnect();
    return;
  }
  
  if (!rawData || rawData.length === 0) {
    console.log('No raw record found with id=53206');
    await prisma.$disconnect();
    return;
  }

  const raw = rawData[0];
  console.log('=== RAW RECORD id=53206 ===');
  console.log('All columns:', Object.keys(raw).join(', '));
  
  // Print all values
  for (const [k, v] of Object.entries(raw)) {
    if (v !== null && v !== undefined) {
      console.log(`  ${k}: ${v}`);
    }
  }

  // Find this record in consolidated_bank_accounts by uuid
  if (raw.uuid) {
    const consol = await prisma.$queryRawUnsafe(`
      SELECT id, nominal_amount, nominal_currency_uuid, account_currency_amount,
             account_currency_uuid, exchange_rate, applied_rule_id, raw_table_name,
             counteragent_uuid, payment_id, description, transaction_date
      FROM consolidated_bank_accounts
      WHERE raw_record_uuid = $1::uuid
    `, raw.uuid);

    if (consol.length > 0) {
      console.log('\n=== CONSOLIDATED MATCH ===');
      console.log(JSON.stringify(consol, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2));
    } else {
      console.log('\nNo consolidated record found for raw uuid:', raw.uuid);
    }
  }

  // Check applied parsing rule
  if (raw.applied_rule_id) {
    const rule = await prisma.$queryRawUnsafe(`
      SELECT * FROM parsing_scheme_rules WHERE id = $1
    `, raw.applied_rule_id);
    console.log('\n=== APPLIED PARSING RULE ===');
    console.log(JSON.stringify(rule, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2));
  }

  // Check if there's a payment_id and what nominal currency the payment has
  if (raw.payment_id) {
    const payment = await prisma.$queryRawUnsafe(`
      SELECT * FROM payments WHERE payment_id = $1 LIMIT 1
    `, raw.payment_id);
    if (payment.length > 0) {
      console.log('\n=== PAYMENT INFO ===');
      console.log(JSON.stringify(payment, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2));
    }
  }

  // Check currencies
  const currencies = await prisma.$queryRawUnsafe(`
    SELECT uuid, code, name FROM currencies 
    WHERE uuid IN ('5a2d799d-22a1-4e0a-b029-8031a1df6d56'::uuid, '0790fb09-2de6-4ea3-a71c-58a007fc62a8'::uuid)
  `);
  console.log('\n=== CURRENCIES ===');
  currencies.forEach(c => console.log(c.uuid, '=', c.code || c.name));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
