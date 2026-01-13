const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const prisma = new PrismaClient();

async function findRecord() {
  try {
    // Search by raw_record_uuid
    const rawRecordUuid = '3ffaca9d-17f6-5103-8668-83afce8f2405';
    
    const consolidated = await prisma.consolidatedBankAccount.findFirst({
      where: { rawRecordUuid: rawRecordUuid },
      select: {
        id: true,
        uuid: true,
        counteragentAccountNumber: true,
        rawRecordUuid: true,
        transactionDate: true,
        description: true
      }
    });
    
    console.log('=== Consolidated Record (by raw_record_uuid) ===');
    if (consolidated) {
      console.log(JSON.stringify(consolidated, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
      console.log('\n✅ Counteragent Account Number:', consolidated.counteragentAccountNumber);
      
      // Check what it should be from raw
      const pool = new Pool({
        connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
        ssl: { rejectUnauthorized: false }
      });
      
      const result = await pool.query(
        'SELECT doccoracct FROM bog_gel_raw_893486000 WHERE uuid = $1',
        [rawRecordUuid]
      );
      
      await pool.end();
      
      if (result.rows.length > 0) {
        console.log('📋 Expected (from doccoracct):', result.rows[0].doccoracct);
        console.log('');
        console.log(consolidated.counteragentAccountNumber === result.rows[0].doccoracct ? '✅ MATCH!' : '❌ MISMATCH');
      }
    } else {
      console.log('❌ Record not found in consolidated table');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findRecord();
