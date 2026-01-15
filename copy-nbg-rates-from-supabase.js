const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const remotePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function copyNBGRates() {
  const remoteClient = await remotePool.connect();
  const localClient = await localPool.connect();
  
  try {
    console.log('📊 Copying NBG Exchange Rates from Supabase to Local...\n');
    
    // Get count from Supabase
    const remoteCount = await remoteClient.query('SELECT COUNT(*) FROM nbg_exchange_rates');
    console.log(`📥 Found ${remoteCount.rows[0].count} rates in Supabase`);
    
    // Get count from Local
    const localCount = await localClient.query('SELECT COUNT(*) FROM nbg_exchange_rates');
    console.log(`📍 Currently ${localCount.rows[0].count} rates in Local\n`);
    
    if (remoteCount.rows[0].count === '0') {
      console.log('❌ No rates in Supabase to copy!');
      return;
    }
    
    // Fetch all rates from Supabase
    console.log('🔄 Fetching rates from Supabase...');
    const rates = await remoteClient.query(`
      SELECT uuid, date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate, created_at, updated_at
      FROM nbg_exchange_rates
      ORDER BY date
    `);
    
    console.log(`✅ Fetched ${rates.rows.length} rates\n`);
    
    // Clear local table
    console.log('🗑️  Truncating local nbg_exchange_rates...');
    await localClient.query('TRUNCATE nbg_exchange_rates');
    console.log('✅ Cleared\n');
    
    // Insert into local
    console.log('💾 Inserting rates into local database...');
    let inserted = 0;
    
    for (const rate of rates.rows) {
      await localClient.query(`
        INSERT INTO nbg_exchange_rates (uuid, date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (date) DO UPDATE SET
          uuid = EXCLUDED.uuid,
          usd_rate = EXCLUDED.usd_rate,
          eur_rate = EXCLUDED.eur_rate,
          cny_rate = EXCLUDED.cny_rate,
          gbp_rate = EXCLUDED.gbp_rate,
          rub_rate = EXCLUDED.rub_rate,
          try_rate = EXCLUDED.try_rate,
          aed_rate = EXCLUDED.aed_rate,
          kzt_rate = EXCLUDED.kzt_rate,
          updated_at = EXCLUDED.updated_at
      `, [
        rate.uuid,
        rate.date,
        rate.usd_rate,
        rate.eur_rate,
        rate.cny_rate,
        rate.gbp_rate,
        rate.rub_rate,
        rate.try_rate,
        rate.aed_rate,
        rate.kzt_rate,
        rate.created_at,
        rate.updated_at
      ]);
      
      inserted++;
      if (inserted % 100 === 0) {
        process.stdout.write(`\r   Progress: ${inserted}/${rates.rows.length}`);
      }
    }
    
    console.log(`\r✅ Inserted ${inserted} rates into local database\n`);
    
    // Verify
    const finalCount = await localClient.query('SELECT COUNT(*) FROM nbg_exchange_rates');
    console.log(`\n📊 Final count in local: ${finalCount.rows[0].count}`);
    
    // Show sample
    const sample = await localClient.query(`
      SELECT date, usd_rate, eur_rate
      FROM nbg_exchange_rates
      ORDER BY date DESC
      LIMIT 3
    `);
    
    console.log('\n📅 Sample rates (latest 3):');
    sample.rows.forEach(row => {
      console.log(`   ${row.date.toISOString().split('T')[0]}: USD=${row.usd_rate}, EUR=${row.eur_rate}`);
    });
    
    console.log('\n✅ NBG rates copied successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    remoteClient.release();
    localClient.release();
    await remotePool.end();
    await localPool.end();
  }
}

copyNBGRates()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
