import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    // Get GE21 account info
    console.log('=== GE21 Account ===');
    const account = await prisma.$queryRaw`
      SELECT uuid, account_number, raw_table_name, is_active, insider_uuid 
      FROM bank_accounts 
      WHERE account_number = 'GE21BG0000000611354669'
    `;
    if (account && (account as any[]).length > 0) {
      const acc = (account as any[])[0];
      console.log('Account found:', acc);
      console.log('Raw table name:', acc.raw_table_name);
      console.log('Is active:', acc.is_active);
    } else {
      console.log('No GE21 account found');
    }

    // Check if raw table exists and has data
    console.log('\n=== GE21 Raw Table ===');
    try {
      const tableStatus = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as row_count FROM "GE21BG0000000611354669_BOG_GEL"`
      );
      console.log('Table row count:', tableStatus);
    } catch (e) {
      console.log('Table query error:', (e as any).message);
    }

    // List counteragents (to see if any might be associated with this account)
    console.log('\n=== Recent Counteragents ===');
    const counteragents = await prisma.$queryRaw`
      SELECT counteragent_uuid, counteragent as name
      FROM counteragents
      ORDER BY created_at DESC
      LIMIT 10
    `;
    console.log('Top 10 counteragents:', JSON.stringify(counteragents, null, 2));

  } catch (e) {
    console.error('Error:', (e as any).message);
  } finally {
    await prisma.$disconnect();
  }
})();
