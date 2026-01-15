const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

function parseDate(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const parts = ddmmyyyy.split('.');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

async function showDeletedDates() {
  const client = await localPool.connect();
  
  try {
    console.log('📅 Records after 19.11.2025 in LOCAL database:\n');
    
    const cutoffDate = '2025-11-19';
    
    // Get all records
    const allRecords = await client.query(`
      SELECT docvaluedate FROM bog_gel_raw_893486000
    `);
    
    // Group by date
    const dateGroups = {};
    let totalAfter = 0;
    
    for (const record of allRecords.rows) {
      const isoDate = parseDate(record.docvaluedate);
      if (isoDate && isoDate > cutoffDate) {
        if (!dateGroups[record.docvaluedate]) {
          dateGroups[record.docvaluedate] = { count: 0, iso: isoDate };
        }
        dateGroups[record.docvaluedate].count++;
        totalAfter++;
      }
    }
    
    // Sort by ISO date
    const sortedDates = Object.entries(dateGroups)
      .sort((a, b) => a[1].iso.localeCompare(b[1].iso));
    
    console.log(`Total records after 19.11.2025: ${totalAfter}\n`);
    console.log('Date (DD.MM.YYYY) | ISO Date    | Count');
    console.log('-'.repeat(50));
    
    for (const [date, info] of sortedDates) {
      console.log(`${date.padEnd(17)} | ${info.iso} | ${info.count}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await localPool.end();
  }
}

showDeletedDates()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
