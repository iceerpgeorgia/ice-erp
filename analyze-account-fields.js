// Check the relationship between doccoracct and the account numbers being stored
const { Pool } = require('pg');

async function analyzeAccountFields() {
  const supabaseUrl = process.env.REMOTE_DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  const pool = new Pool({
    connectionString: supabaseUrl,
    max: 1,
    ssl: false // Try without SSL for local testing
  });
  
  try {
    // Get a sample of records to understand the fields
    const result = await pool.query(`
      SELECT 
        id,
        dockey,
        entriesid,
        entrydbamt,
        entrycramt,
        doccoracct,
        docsenderacctno,
        docbenefacctno,
        docsenderinn,
        docbenefinn,
        docsendername,
        docbenefname
      FROM bog_gel_raw_893486000 
      WHERE doccoracct LIKE '%GE87BG0000000609365272%'
      LIMIT 5
    `);
    
    console.log('=== Records with doccoracct containing GE87BG0000000609365272 ===\n');
    result.rows.forEach((row, idx) => {
      console.log(`Record ${idx + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Key: ${row.dockey}_${row.entriesid}`);
      console.log(`  DB Amount: ${row.entrydbamt}`);
      console.log(`  CR Amount: ${row.entrycramt}`);
      console.log(`  doccoracct: ${row.doccoracct}`);
      console.log(`  docsenderacctno: ${row.docsenderacctno}`);
      console.log(`  docbenefacctno: ${row.docbenefacctno}`);
      console.log(`  docsenderinn: ${row.docsenderinn}`);
      console.log(`  docbenefinn: ${row.docbenefinn}`);
      console.log(`  docsendername: ${row.docsendername}`);
      console.log(`  docbenefname: ${row.docbenefname}`);
      console.log('');
    });
    
    // Also check a record with the other account number
    console.log('\n=== Records with account GE82TB7121745061100015 ===\n');
    const result2 = await pool.query(`
      SELECT 
        id,
        doccoracct,
        docsenderacctno,
        docbenefacctno,
        entrydbamt,
        entrycramt
      FROM bog_gel_raw_893486000 
      WHERE doccoracct LIKE '%GE82TB7121745061100015%'
         OR docsenderacctno LIKE '%GE82TB7121745061100015%'
         OR docbenefacctno LIKE '%GE82TB7121745061100015%'
      LIMIT 3
    `);
    
    result2.rows.forEach((row, idx) => {
      console.log(`Record ${idx + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  doccoracct: ${row.doccoracct}`);
      console.log(`  docsenderacctno: ${row.docsenderacctno}`);
      console.log(`  docbenefacctno: ${row.docbenefacctno}`);
      console.log(`  DB: ${row.entrydbamt}, CR: ${row.entrycramt}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeAccountFields();
