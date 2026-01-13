const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const prisma = new PrismaClient();

async function checkRecord() {
  try {
    // Check consolidated table
    const consolidated = await prisma.consolidatedBankAccount.findFirst({
      where: { id: BigInt(203) },
      select: {
        id: true,
        uuid: true,
        counteragentAccountNumber: true,
        rawRecordUuid: true,
        transactionDate: true,
        description: true
      }
    });
    
    console.log('=== Consolidated Bank Account (ID 203) ===');
    console.log(JSON.stringify(consolidated, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    
    if (consolidated?.rawRecordUuid) {
      // Check raw table in Supabase
      const supabaseUrl = process.env.REMOTE_DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
      const pool = new Pool({
        connectionString: supabaseUrl,
        max: 1,
        ssl: { rejectUnauthorized: false }
      });
      
      const result = await pool.query(
        'SELECT uuid, doccoracct, docsendername, docreceivername, docdescr FROM bog_gel_raw_893486000 WHERE uuid = $1',
        [consolidated.rawRecordUuid]
      );
      
      await pool.end();
      
      console.log('\n=== Raw Bank Statement Record ===');
      if (result.rows.length > 0) {
        console.log(JSON.stringify(result.rows[0], (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
      } else {
        console.log('No raw record found');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecord();
