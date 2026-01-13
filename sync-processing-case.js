const { Pool } = require('pg');

const supabasePool = new Pool({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const localPool = new Pool({
  connectionString: 'postgresql://postgres:fulebimojviT1985%@localhost:5432/ICE_ERP',
});

async function syncProcessingCase() {
  const supabaseClient = await supabasePool.connect();
  const localClient = await localPool.connect();
  
  try {
    // First check if local has the raw table at all
    const tableCheck = await localClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bog_gel_raw_893486000'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Raw table does not exist locally');
      console.log('The bog_gel_raw_893486000 table needs to be created first');
      return;
    }
    
    // Check if processing_case column exists in Supabase
    const supabaseCols = await supabaseClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bog_gel_raw_893486000' 
      AND column_name IN ('processing_case', 'counteragent_processed', 'counteragent_inn')
      ORDER BY column_name
    `);
    
    console.log('Columns in Supabase raw table:', supabaseCols.rows.map(r => r.column_name).join(', '));
    
    // Add processing_case column to consolidated if it doesn't exist
    console.log('\n📝 Adding processing_case column to consolidated_bank_accounts...');
    await localClient.query(`
      ALTER TABLE consolidated_bank_accounts 
      ADD COLUMN IF NOT EXISTS processing_case TEXT
    `);
    
    // Update consolidated table with computed case logic
    console.log('🔄 Computing processing_case based on counteragent_uuid...');
    await localClient.query(`
      UPDATE consolidated_bank_accounts
      SET processing_case = CASE
        WHEN counteragent_uuid IS NOT NULL THEN 'CASE 1: Counteragent Matched'
        ELSE 'CASE 2/3: No Counteragent'
      END
    `);
    
    const updated = await localClient.query('SELECT COUNT(*) FROM consolidated_bank_accounts WHERE processing_case IS NOT NULL');
    console.log(`✅ Updated ${updated.rows[0].count} records with processing_case`);
    
    // Create index
    await localClient.query(`
      CREATE INDEX IF NOT EXISTS idx_consolidated_processing_case 
      ON consolidated_bank_accounts(processing_case)
    `);
    console.log('✅ Index created');
    
  } finally {
    supabaseClient.release();
    localClient.release();
    await supabasePool.end();
    await localPool.end();
  }
}

syncProcessingCase().catch(console.error);
