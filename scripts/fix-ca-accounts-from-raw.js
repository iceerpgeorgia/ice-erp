const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const useRemote = process.argv.includes('--remote') || process.argv.includes('--supabase');
const connectionString = useRemote 
  ? process.env.REMOTE_DATABASE_URL 
  : process.env.DATABASE_URL;

const dbName = useRemote ? 'Supabase' : 'Local';
console.log(`\n🔗 Using ${dbName} database\n`);

const client = new Client({
  connectionString,
  ssl: useRemote ? { rejectUnauthorized: false } : false
});

async function fixFromRaw() {
  try {
    await client.connect();
    console.log('✅ Connected\n');

    console.log('🔍 Finding records with scientific notation...');
    const badRecords = await client.query(`
      SELECT c.id, c.raw_record_uuid, c.counteragent_account_number
      FROM consolidated_bank_accounts c
      WHERE c.counteragent_account_number LIKE '%e+%' OR c.counteragent_account_number LIKE '%e-%'
      LIMIT 5000
    `);
    
    console.log(`   Found ${badRecords.rows.length} records\n`);
    
    if (badRecords.rows.length === 0) {
      console.log('✅ No records need fixing!');
      return;
    }

    console.log('🔄 Extracting correct account numbers from raw data...\n');
    let fixedCount = 0;
    let notFoundCount = 0;
    
    for (const record of badRecords.rows) {
      try {
        // Get raw data
        const rawResult = await client.query(`
          SELECT 
            docsenderacctno,
            docbenefacctno,
            entrydbamt
          FROM bog_gel_raw_893486000
          WHERE uuid = $1
        `, [record.raw_record_uuid]);
        
        if (rawResult.rows.length === 0) {
          notFoundCount++;
          continue;
        }
        
        const raw = rawResult.rows[0];
        let correctAccount = null;
        
        // Determine direction and extract account
        if (raw.entrydbamt === null || raw.entrydbamt === undefined) {
          // Incoming - sender account
          correctAccount = raw.docsenderacctno?.trim();
        } else {
          // Outgoing - beneficiary account
          correctAccount = raw.docbenefacctno?.trim();
        }
        
        if (correctAccount) {
          // Update with correct value
          await client.query(`
            UPDATE consolidated_bank_accounts
            SET counteragent_account_number = $1::text, updated_at = NOW()
            WHERE id = $2
          `, [correctAccount, record.id]);
          
          fixedCount++;
          
          if (fixedCount % 100 === 0) {
            console.log(`   ✅ Fixed ${fixedCount}/${badRecords.rows.length}...`);
          }
        } else {
          notFoundCount++;
        }
        
      } catch (error) {
        console.error(`   ❌ Error fixing record ${record.id}:`, error.message);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Fixed: ${fixedCount}`);
    console.log(`   ⚠️  Not found in raw: ${notFoundCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

fixFromRaw();
