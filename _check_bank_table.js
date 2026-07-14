const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBankTable() {
  try {
    console.log('🔍 Checking GE65TB7856036050100002_TBC_GEL table...\n');

    // Query the bank table for records matching our counteragent
    const records = await prisma.$queryRawUnsafe(`
      SELECT 
        uuid,
        transaction_date,
        entrydbamt,
        entrycramt,
        docnomination,
        counteragent_uuid,
        payment_id,
        docsenderinn,
        docbenefinn,
        doccomment,
        created_at
      FROM "GE65TB7856036050100002_TBC_GEL"
      WHERE counteragent_uuid = 'B4968862-3843-414D-9E73-1A7611618B41'
        OR payment_id = 'e6f02e_8f_41c001'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    console.log('📋 Records in GE65TB7856036050100002_TBC_GEL table:\n');
    console.log('━'.repeat(80));
    
    if (records && records.length > 0) {
      records.forEach((r, idx) => {
        console.log(`Record ${idx + 1}:`);
        console.log(`  UUID:             ${r.uuid}`);
        console.log(`  Date:             ${r.transaction_date}`);
        console.log(`  Debit (GEL):      ${r.entrydbamt || 'NULL'}`);
        console.log(`  Credit (GEL):     ${r.entrycramt || 'NULL'}`);
        console.log(`  Counteragent:     ${r.counteragent_uuid}`);
        console.log(`  Payment ID:       ${r.payment_id || 'NULL'}`);
        console.log(`  Document:         ${r.docnomination || 'NULL'}`);
        console.log(`  Comment:          ${r.doccomment || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log('❌ No records found matching counteragent or payment ID');
    }
    console.log('━'.repeat(80));

    // Check if table exists and has any data
    console.log('\n\n📊 Table Statistics:\n');
    console.log('━'.repeat(80));
    const stats = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT counteragent_uuid) as unique_counteragents,
        MIN(transaction_date) as earliest_date,
        MAX(transaction_date) as latest_date
      FROM "GE65TB7856036050100002_TBC_GEL"
    `);

    if (stats && stats.length > 0) {
      const s = stats[0];
      console.log(`Total Records:        ${s.total_records}`);
      console.log(`Unique Counteragents: ${s.unique_counteragents}`);
      console.log(`Date Range:           ${s.earliest_date} to ${s.latest_date}`);
    }
    console.log('━'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBankTable();
