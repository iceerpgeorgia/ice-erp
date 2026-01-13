const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const prisma = new PrismaClient();

async function debugRecord() {
  try {
    // Check consolidated table
    console.log('=== Consolidated Bank Account (ID 58402) ===');
    const consolidated = await prisma.consolidatedBankAccount.findFirst({
      where: { id: BigInt(58402) },
      select: {
        id: true,
        uuid: true,
        counteragentAccountNumber: true,
        rawRecordUuid: true,
        transactionDate: true,
        description: true
      }
    });
    
    console.log(JSON.stringify(consolidated, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    
    if (consolidated?.rawRecordUuid) {
      // Check raw table in Supabase
      const pool = new Pool({
        connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
        ssl: { rejectUnauthorized: false }
      });
      
      console.log('\n=== Raw Bank Statement Record ===');
      const result = await pool.query(
        `SELECT 
          uuid, 
          doccoracct,
          docsenderacctno,
          docbenefacctno,
          entrydbamt,
          entrycramt,
          docsenderinn,
          docbenefinn,
          docsendername,
          docbenefname,
          dockey,
          entriesid
        FROM bog_gel_raw_893486000 
        WHERE uuid = $1`,
        [consolidated.rawRecordUuid]
      );
      
      await pool.end();
      
      if (result.rows.length > 0) {
        const raw = result.rows[0];
        console.log('UUID:', raw.uuid);
        console.log('Key:', `${raw.dockey}_${raw.entriesid}`);
        console.log('');
        console.log('Account fields:');
        console.log('  doccoracct:', raw.doccoracct);
        console.log('  docsenderacctno:', raw.docsenderacctno);
        console.log('  docbenefacctno:', raw.docbenefacctno);
        console.log('');
        console.log('Amounts (to determine incoming/outgoing):');
        console.log('  entrydbamt (debit):', raw.entrydbamt);
        console.log('  entrycramt (credit):', raw.entrycramt);
        console.log('  Direction:', raw.entrydbamt === null ? 'INCOMING' : 'OUTGOING');
        console.log('');
        console.log('INN fields:');
        console.log('  docsenderinn:', raw.docsenderinn);
        console.log('  docbenefinn:', raw.docbenefinn);
        console.log('');
        console.log('Name fields:');
        console.log('  docsendername:', raw.docsendername);
        console.log('  docbenefname:', raw.docbenefname);
        console.log('');
        console.log('=== LOGIC ANALYSIS ===');
        console.log('Expected counteragent_account_number (by priority):');
        console.log('  1. doccoracct (PRIORITY):', raw.doccoracct || 'NULL/EMPTY');
        if (!raw.doccoracct || !raw.doccoracct.trim()) {
          console.log('  2. Fallback to:', raw.entrydbamt === null ? 'docsenderacctno' : 'docbenefacctno');
          console.log('     Value:', raw.entrydbamt === null ? raw.docsenderacctno : raw.docbenefacctno);
        }
        console.log('');
        console.log('Actual in consolidated table:', consolidated.counteragentAccountNumber);
        console.log('Match:', consolidated.counteragentAccountNumber === (raw.doccoracct || (raw.entrydbamt === null ? raw.docsenderacctno : raw.docbenefacctno)) ? '✅' : '❌');
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

debugRecord();
