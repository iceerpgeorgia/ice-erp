require('dotenv').config({path:'.env'});
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

const searchId = '58836782105_15736156270';

async function main() {
  console.log(`\nSearching for record: ${searchId}\n`);
  console.log('='.repeat(70));
  
  // This looks like dockey_entriesid format, search by rawRecordUuid
  let record = await prisma.consolidatedBankAccount.findFirst({
    where: { rawRecordUuid: searchId }
  });
  
  if (record) {
    console.log('✅ Found by rawRecordUuid:\n');
    console.log(JSON.stringify(record, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    , 2));
  } else {
    console.log('❌ Not found in consolidated table');
    console.log('\nTrying to find in raw table...\n');
    
    // Check if it exists in raw table
    const rawQuery = `SELECT * FROM bog_gel_raw_893486000 WHERE uuid = $1 LIMIT 1`;
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL.split('?')[0] });
    
    try {
      const result = await pool.query(rawQuery, [searchId]);
      if (result.rows.length > 0) {
        console.log('✅ Found in RAW table:\n');
        console.log(JSON.stringify(result.rows[0], null, 2));
      } else {
        console.log('❌ Not found in raw table either');
      }
      await pool.end();
    } catch (e) {
      console.error('Error querying raw table:', e.message);
      await pool.end();
    }
  }
  
  console.log('\n' + '='.repeat(70));
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e.message);
  prisma.$disconnect();
  process.exit(1);
});
