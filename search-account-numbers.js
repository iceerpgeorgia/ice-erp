const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const prisma = new PrismaClient();

async function searchRecords() {
  try {
    // Search for the correct account number in consolidated table
    console.log('=== Searching for GE87BG0000000609365272 ===');
    const correctAccount = await prisma.consolidatedBankAccount.findMany({
      where: {
        counteragentAccountNumber: {
          contains: 'GE87BG0000000609365272'
        }
      },
      select: {
        id: true,
        uuid: true,
        counteragentAccountNumber: true,
        transactionDate: true,
        description: true
      },
      take: 5
    });
    
    console.log('Records with GE87BG0000000609365272:');
    console.log(JSON.stringify(correctAccount, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    
    // Search for the wrong account number
    console.log('\n=== Searching for GE82TB7121745061100015 ===');
    const wrongAccount = await prisma.consolidatedBankAccount.findMany({
      where: {
        counteragentAccountNumber: {
          contains: 'GE82TB7121745061100015'
        }
      },
      select: {
        id: true,
        uuid: true,
        counteragentAccountNumber: true,
        transactionDate: true,
        description: true
      },
      take: 5
    });
    
    console.log('Records with GE82TB7121745061100015:');
    console.log(JSON.stringify(wrongAccount, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    
    // Now check raw table for the correct account
    const supabaseUrl = process.env.REMOTE_DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
    const pool = new Pool({
      connectionString: supabaseUrl,
      max: 1,
      ssl: { rejectUnauthorized: false }
    });
    
    console.log('\n=== Searching raw table for GE87BG0000000609365272 ===');
    const rawResult = await pool.query(
      "SELECT id, uuid, doccoracct, docsendername, docreceivername FROM bog_gel_raw_893486000 WHERE doccoracct LIKE '%GE87BG0000000609365272%' LIMIT 5"
    );
    
    console.log('Raw records with doccoracct containing GE87BG0000000609365272:');
    console.log(JSON.stringify(rawResult.rows, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    
    await pool.end();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

searchRecords();
