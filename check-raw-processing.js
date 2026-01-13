const { Pool } = require('pg');

async function checkRawRecord() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const result = await pool.query(
      `SELECT 
        uuid,
        dockey,
        entriesid,
        doccoracct,
        docsenderacctno,
        docbenefacctno,
        counteragent_processed,
        counteragent_inn,
        parsing_rule_processed,
        payment_id_processed,
        is_processed
      FROM bog_gel_raw_893486000 
      WHERE uuid = $1`,
      ['3ffaca9d-17f6-5103-8668-83afce8f2405']
    );
    
    if (result.rows.length > 0) {
      const raw = result.rows[0];
      console.log('=== Raw Record Processing Status ===');
      console.log('Key:', `${raw.dockey}_${raw.entriesid}`);
      console.log('UUID:', raw.uuid);
      console.log('');
      console.log('Account Numbers:');
      console.log('  doccoracct:', raw.doccoracct);
      console.log('  docsenderacctno:', raw.docsenderacctno);
      console.log('  docbenefacctno:', raw.docbenefacctno);
      console.log('');
      console.log('Processing Flags:');
      console.log('  counteragent_processed:', raw.counteragent_processed);
      console.log('  counteragent_inn:', raw.counteragent_inn);
      console.log('  parsing_rule_processed:', raw.parsing_rule_processed);
      console.log('  payment_id_processed:', raw.payment_id_processed);
      console.log('  is_processed:', raw.is_processed);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRawRecord();
