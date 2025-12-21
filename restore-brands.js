const { Client } = require('pg');

const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';

// These are the 23 brands with SUPABASE UUIDs (from earlier check)
const brands = [
  { uuid: 'd20debc9-128b-43e2-853e-406dc634cc1a', name: '///' },
  { uuid: 'cdd322cd-817a-4910-8bb9-d07fb7394f38', name: 'AH&MET' },
  { uuid: 'c4f116d4-8e28-4a98-8457-0d77522e9423', name: 'AKE' },
  { uuid: '69debcac-ba1d-4d07-8e59-d6572b0585b0', name: 'AYHA' },
  { uuid: '57b3f036-66f3-42b3-bee1-f3bf7f813287', name: 'AYVAZ' },
  { uuid: 'f411a3c3-8749-4967-81dd-f5c7bafdc7f0', name: 'Carrier' },
  { uuid: '39f5db17-8285-4faa-bd5e-042c9a12c797', name: 'DELFAR' },
  { uuid: '264b043a-d136-41c9-8b31-b31bb3373430', name: 'FU ZHOU' },
  { uuid: '9e493a2b-d996-4680-a018-dd0663cde4da', name: 'KLEEMAN' },
  { uuid: 'a1bb8da7-fb5c-4d8e-93df-348bdd492f0c', name: 'Kone' },
  { uuid: 'b9c49d83-3e3f-48b9-8b44-b93fa694cf44', name: 'LG' },
  { uuid: '0b375a1f-2e3f-435f-aaee-344c9db2bbf3', name: 'MELCO' },
  { uuid: '455cad36-d16d-4356-90c4-e316036b3fbc', name: 'Midea' },
  { uuid: '072da69d-e3f6-4765-9f95-0b1c76831652', name: 'Mitsubishi Heavy Industries (MHI)' },
  { uuid: '130b90ec-e4c7-43c1-be0c-9e0a24e6ed6c', name: 'N/A' },
  { uuid: 'cb52efd4-7e5c-40a6-9159-14ea7dd3d38d', name: 'ONAY LIFT' },
  { uuid: '57e563e9-cfc1-4f9b-885e-c9c59f076275', name: 'OTIS' },
  { uuid: '526fd746-78db-423e-bd98-1338f8338f87', name: 'Ozinan' },
  { uuid: '7ca6b688-0d3d-46d2-b03c-438424ec85a4', name: 'PROLIFT' },
  { uuid: 'f22abd15-9054-47e7-ab6c-9d66c2a7ffb0', name: 'SMEC' },
  { uuid: '9f004db6-760a-4d8f-acc2-0fc158d5ca2e', name: 'Toshiba' },
  { uuid: '6960c489-1957-4222-9504-1ef2a0e2fa1b', name: 'Wittur' },
  { uuid: 'b5f718e5-9338-4be4-8639-2bdc164ba7b2', name: 'Yukselish' }
];

async function restoreBrands(dbUrl, dbName) {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`\n=== Restoring ${brands.length} brands to ${dbName} ===`);
    
    for (const brand of brands) {
      await client.query(`
        INSERT INTO brands (uuid, name, is_active, created_at, updated_at)
        VALUES ($1, $2, true, now(), now())
        ON CONFLICT (uuid) DO NOTHING
      `, [brand.uuid, brand.name]);
    }
    
    const count = await client.query('SELECT COUNT(*) FROM brands');
    console.log(`✓ Successfully restored ${count.rows[0].count} brands in ${dbName}`);
    
  } catch (error) {
    console.error(`Error restoring brands to ${dbName}:`, error);
  } finally {
    await client.end();
  }
}

(async () => {
  await restoreBrands(SUPABASE, 'SUPABASE');
  await restoreBrands(LOCAL, 'LOCAL');
  console.log('\n=== Done! ===');
})();
