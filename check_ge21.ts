import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    // Check if GE21 account exists and is active
    const account = await prisma.$queryRaw`
      SELECT uuid, account_number, raw_table_name, is_active, insider_uuid, currency_uuid
      FROM bank_accounts 
      WHERE account_number = 'GE21BG0000000611354669'
    `;
    console.log('Account row:', JSON.stringify(account, null, 2));

    if (account && (account as any[]).length > 0) {
      const acc = (account as any[])[0];
      const tableName = acc.raw_table_name;
      
      // Check if table exists
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        ) as exists
      `;
      console.log('\nTable exists:', tableExists);

      // Count rows in the table
      if ((tableExists as any[])[0].exists) {
        const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}"`);
        console.log(`Rows in ${tableName}:`, count);
      }
    }
  } catch (e) {
    console.error('Error:', (e as any).message);
  } finally {
    await prisma.$disconnect();
  }
})();
