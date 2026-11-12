require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGe21() {
  try {
    console.log('=== GE21 Account Status ===\n');

    // Query 1: Check GE21 account metadata
    const ge21Account = await prisma.$queryRaw`
      SELECT 
        uuid, 
        account_number, 
        raw_table_name, 
        is_active, 
        insider_uuid,
        currency_uuid
      FROM bank_accounts 
      WHERE account_number = 'GE21BG0000000611354669'
    `;

    console.log('1. GE21 Account Metadata:');
    console.log(JSON.stringify(ge21Account, null, 2));

    // Query 2: Check if GE21 raw table exists and has rows
    let tableStatus = { exists: false, rowCount: 0 };
    try {
      const result = await prisma.$queryRawUnsafe(
        'SELECT COUNT(*) as count FROM "GE21BG0000000611354669_BOG_GEL"'
      );
      tableStatus = {
        exists: true,
        rowCount: result?.[0]?.count ?? 0
      };
    } catch (e) {
      console.log('\n2. GE21 Raw Table Status: TABLE DOES NOT EXIST');
      console.log('   Error:', e.message);
      tableStatus = { exists: false };
    }

    if (tableStatus.exists) {
      console.log('\n2. GE21 Raw Table Status:');
      console.log(`   Exists: Yes`);
      console.log(`   Row Count: ${tableStatus.rowCount}`);
    }

    // Query 3: List all active accounts
    const allActiveAccounts = await prisma.$queryRaw`
      SELECT 
        account_number,
        raw_table_name,
        is_active,
        insider_uuid
      FROM bank_accounts
      WHERE is_active = true
      ORDER BY id
    `;

    console.log('\n3. All Active Accounts:');
    console.log(`   Total Active: ${allActiveAccounts.length}`);
    const ge21InList = allActiveAccounts.find((a) => a.account_number === 'GE21BG0000000611354669');
    if (ge21InList) {
      console.log(`   GE21 Status: ✓ PRESENT`);
      console.log(`   - raw_table_name: ${ge21InList.raw_table_name}`);
      console.log(`   - is_active: ${ge21InList.is_active}`);
    } else {
      console.log(`   GE21 Status: ✗ NOT IN ACTIVE LIST`);
    }

    // Query 4: Check the actual insider UUID being used
    if (ge21InList) {
      const primaryInsider = allActiveAccounts.find((a) => a.insider_uuid);
      console.log('\n4. Insider UUID Comparison:');
      console.log(`   GE21 insider_uuid: ${ge21InList.insider_uuid}`);
      console.log(`   Most common insider: ${primaryInsider?.insider_uuid}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGe21();
