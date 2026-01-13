const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkCounterагent() {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT counteragent_uuid, counteragent, identification_number FROM counteragents WHERE identification_number IN ($1, $2)',
      ['1019020239', '01019020239']
    );
    
    console.log('Search results for INNs: 1019020239 and 01019020239');
    console.log('=================================================');
    if (res.rows.length === 0) {
      console.log('❌ No counteragent found with either INN');
    } else {
      console.log(`✅ Found ${res.rows.length} counteragent(s):`);
      res.rows.forEach(r => {
        console.log(`   UUID: ${r.counteragent_uuid}`);
        console.log(`   Name: ${r.counteragent}`);
        console.log(`   INN: ${r.identification_number}`);
      });
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkCounterагent().catch(console.error);
