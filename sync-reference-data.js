const { Client } = require('pg');

async function syncReferenceData() {
  const localClient = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });

  const supabaseClient = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });

  try {
    console.log('Connecting to databases...');
    await localClient.connect();
    await supabaseClient.connect();

    // Get unique UUIDs from projects in local database
    console.log('\n📊 Analyzing missing reference data...\n');

    const missingCounteragents = await localClient.query(`
      SELECT DISTINCT p.counteragent_uuid
      FROM projects p
      LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
      WHERE p.counteragent_uuid IS NOT NULL AND c.counteragent_uuid IS NULL
    `);
    console.log(`Missing counteragents: ${missingCounteragents.rows.length}`);

    const missingFinancialCodes = await localClient.query(`
      SELECT DISTINCT p.financial_code_uuid
      FROM projects p
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      WHERE p.financial_code_uuid IS NOT NULL AND fc.uuid IS NULL
    `);
    console.log(`Missing financial codes: ${missingFinancialCodes.rows.length}`);

    const missingCurrencies = await localClient.query(`
      SELECT DISTINCT p.currency_uuid
      FROM projects p
      LEFT JOIN currencies cur ON p.currency_uuid = cur.uuid
      WHERE p.currency_uuid IS NOT NULL AND cur.uuid IS NULL
    `);
    console.log(`Missing currencies: ${missingCurrencies.rows.length}`);

    const missingStates = await localClient.query(`
      SELECT DISTINCT p.state_uuid
      FROM projects p
      LEFT JOIN project_states ps ON p.state_uuid = ps.uuid
      WHERE p.state_uuid IS NOT NULL AND ps.uuid IS NULL
    `);
    console.log(`Missing project states: ${missingStates.rows.length}`);

    console.log('\n📥 Syncing reference data from Supabase...\n');

    // Skip counteragents - they likely exist in local, just verify
    console.log('Skipping counteragents (should already exist in local DB)');

    // Sync Financial Codes
    if (missingFinancialCodes.rows.length > 0) {
      const uuids = missingFinancialCodes.rows.map(r => r.financial_code_uuid);
      const financialCodes = await supabaseClient.query(`
        SELECT * FROM financial_codes WHERE uuid = ANY($1::uuid[])
      `, [uuids]);

      console.log(`Syncing ${financialCodes.rows.length} financial codes...`);
      for (const fc of financialCodes.rows) {
        await localClient.query(`
          INSERT INTO financial_codes (
            id, created_at, updated_at, uuid, code, name, validation, applies_to_pl,
            applies_to_cf, is_income, parent_uuid, description, depth, sort_order, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (uuid) DO NOTHING
        `, [
          fc.id, fc.created_at, fc.updated_at, fc.uuid, fc.code || '', fc.name,
          fc.validation, fc.applies_to_pl, fc.applies_to_cf, fc.is_income,
          fc.parent_uuid, fc.description, fc.depth, fc.sort_order, fc.is_active
        ]);
      }
      console.log(`✅ Synced ${financialCodes.rows.length} financial codes`);
    }

    // Sync Currencies
    if (missingCurrencies.rows.length > 0) {
      const uuids = missingCurrencies.rows.map(r => r.currency_uuid);
      const currencies = await supabaseClient.query(`
        SELECT * FROM currencies WHERE uuid = ANY($1::uuid[])
      `, [uuids]);

      console.log(`Syncing ${currencies.rows.length} currencies...`);
      for (const cur of currencies.rows) {
        await localClient.query(`
          INSERT INTO currencies (
            id, created_at, updated_at, uuid, code, name, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (uuid) DO NOTHING
        `, [
          cur.id, cur.created_at, cur.updated_at, cur.uuid, cur.code,
          cur.name, cur.is_active
        ]);
      }
      console.log(`✅ Synced ${currencies.rows.length} currencies`);
    }

    // Sync Project States
    if (missingStates.rows.length > 0) {
      const uuids = missingStates.rows.map(r => r.state_uuid);
      const states = await supabaseClient.query(`
        SELECT * FROM project_states WHERE uuid = ANY($1::uuid[])
      `, [uuids]);

      console.log(`Syncing ${states.rows.length} project states...`);
      for (const st of states.rows) {
        await localClient.query(`
          INSERT INTO project_states (
            id, created_at, updated_at, uuid, name
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (uuid) DO NOTHING
        `, [st.id, st.created_at, st.updated_at, st.uuid, st.name]);
      }
      console.log(`✅ Synced ${states.rows.length} project states`);
    }

    console.log('\n✅ Reference data sync complete!\n');
    console.log('Run check-uuid-integrity.js again to verify all issues are resolved.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await localClient.end();
    await supabaseClient.end();
  }
}

syncReferenceData();
