const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function checkSchemaDifferences() {
  console.log('🔍 Checking schema differences between LOCAL and SUPABASE...\n');

  const localPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const remotePool = new Pool({ connectionString: process.env.REMOTE_DATABASE_URL });

  try {
    // Check consolidated_bank_accounts columns
    console.log('📊 consolidated_bank_accounts columns:\n');
    
    const localCols = await localPool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consolidated_bank_accounts'
      ORDER BY ordinal_position
    `);
    
    const remoteCols = await remotePool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consolidated_bank_accounts'
      ORDER BY ordinal_position
    `);
    
    const localColNames = localCols.rows.map(r => r.column_name);
    const remoteColNames = remoteCols.rows.map(r => r.column_name);
    
    const missingOnRemote = localColNames.filter(c => !remoteColNames.includes(c));
    const missingOnLocal = remoteColNames.filter(c => !localColNames.includes(c));
    
    if (missingOnRemote.length > 0) {
      console.log('❌ Columns in LOCAL but missing on SUPABASE:');
      missingOnRemote.forEach(col => {
        const details = localCols.rows.find(r => r.column_name === col);
        console.log(`   - ${col} (${details.data_type}, nullable: ${details.is_nullable})`);
      });
    }
    
    if (missingOnLocal.length > 0) {
      console.log('❌ Columns in SUPABASE but missing on LOCAL:');
      missingOnLocal.forEach(col => {
        const details = remoteCols.rows.find(r => r.column_name === col);
        console.log(`   - ${col} (${details.data_type}, nullable: ${details.is_nullable})`);
      });
    }
    
    if (missingOnRemote.length === 0 && missingOnLocal.length === 0) {
      console.log('✅ consolidated_bank_accounts columns match!\n');
    } else {
      console.log('');
    }

    // Check BOG GEL raw table columns
    const localRawTableQuery = await localPool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name LIKE 'bog_gel_raw_%' 
      ORDER BY table_name DESC LIMIT 1
    `);
    
    const remoteRawTableQuery = await remotePool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name LIKE 'bog_gel_raw_%' 
      ORDER BY table_name DESC LIMIT 1
    `);
    
    if (localRawTableQuery.rows[0] && remoteRawTableQuery.rows[0]) {
      const localRawTable = localRawTableQuery.rows[0].table_name;
      const remoteRawTable = remoteRawTableQuery.rows[0].table_name;
      
      console.log(`📊 Raw table columns (LOCAL: ${localRawTable}, SUPABASE: ${remoteRawTable}):\n`);
      
      const localRawCols = await localPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [localRawTable]);
      
      const remoteRawCols = await remotePool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [remoteRawTable]);
      
      const localRawColNames = localRawCols.rows.map(r => r.column_name);
      const remoteRawColNames = remoteRawCols.rows.map(r => r.column_name);
      
      const missingRawOnRemote = localRawColNames.filter(c => !remoteRawColNames.includes(c));
      const missingRawOnLocal = remoteRawColNames.filter(c => !localRawColNames.includes(c));
      
      if (missingRawOnRemote.length > 0) {
        console.log('❌ Columns in LOCAL but missing on SUPABASE:');
        missingRawOnRemote.forEach(col => {
          const details = localRawCols.rows.find(r => r.column_name === col);
          console.log(`   - ${col} (${details.data_type}, nullable: ${details.is_nullable})`);
        });
      }
      
      if (missingRawOnLocal.length > 0) {
        console.log('❌ Columns in SUPABASE but missing on LOCAL:');
        missingRawOnLocal.forEach(col => {
          const details = remoteRawCols.rows.find(r => r.column_name === col);
          console.log(`   - ${col} (${details.data_type}, nullable: ${details.is_nullable})`);
        });
      }
      
      if (missingRawOnRemote.length === 0 && missingRawOnLocal.length === 0) {
        console.log('✅ Raw table columns match!\n');
      } else {
        console.log('');
      }
    }

    // Check record counts
    console.log('📊 Record counts:\n');
    
    const localCount = await localPool.query('SELECT COUNT(*) FROM consolidated_bank_accounts');
    const remoteCount = await remotePool.query('SELECT COUNT(*) FROM consolidated_bank_accounts');
    
    console.log(`   LOCAL:    ${localCount.rows[0].count} records`);
    console.log(`   SUPABASE: ${remoteCount.rows[0].count} records`);
    
    if (localCount.rows[0].count !== remoteCount.rows[0].count) {
      console.log(`   ⚠️  Difference: ${Math.abs(localCount.rows[0].count - remoteCount.rows[0].count)} records`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await localPool.end();
    await remotePool.end();
  }
}

checkSchemaDifferences();
