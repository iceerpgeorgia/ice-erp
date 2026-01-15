const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkRecordLocation() {
  console.log('\n=== Checking Record 525977 Location ===\n');
  
  // Check local database (Prisma)
  console.log('1. Checking LOCAL database (Prisma/DATABASE_URL)...');
  const prisma = new PrismaClient();
  try {
    const localRecord = await prisma.consolidatedBankAccount.findUnique({
      where: { id: BigInt(525977) },
      select: {
        id: true,
        nominalAmount: true,
        nominalCurrencyUuid: true,
        accountCurrencyAmount: true,
        paymentId: true
      }
    });
    
    if (localRecord) {
      console.log('✓ Found in LOCAL database:');
      console.log('  - Nominal Amount:', localRecord.nominalAmount?.toString());
      console.log('  - Account Amount:', localRecord.accountCurrencyAmount?.toString());
      console.log('  - Payment ID:', localRecord.paymentId);
      console.log('  - Nominal Currency UUID:', localRecord.nominalCurrencyUuid);
    } else {
      console.log('✗ NOT found in LOCAL database');
    }
  } catch (error) {
    console.log('✗ Error checking local:', error.message);
  } finally {
    await prisma.$disconnect();
  }
  
  // Check Supabase (REMOTE_DATABASE_URL)
  console.log('\n2. Checking SUPABASE database (REMOTE_DATABASE_URL)...');
  const pool = new Pool({
    connectionString: process.env.REMOTE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const result = await pool.query(
      'SELECT id, nominal_amount, nominal_currency_uuid, account_currency_amount, payment_id FROM consolidated_bank_accounts WHERE id = $1',
      [525977]
    );
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('✓ Found in SUPABASE:');
      console.log('  - Nominal Amount:', row.nominal_amount);
      console.log('  - Account Amount:', row.account_currency_amount);
      console.log('  - Payment ID:', row.payment_id);
      console.log('  - Nominal Currency UUID:', row.nominal_currency_uuid);
    } else {
      console.log('✗ NOT found in SUPABASE');
    }
  } catch (error) {
    console.log('✗ Error checking Supabase:', error.message);
  } finally {
    await pool.end();
  }
  
  console.log('\n=== Check Complete ===\n');
}

checkRecordLocation();
