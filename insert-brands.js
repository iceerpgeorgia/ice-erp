const { Client } = require('pg');

const brandsData = [
  ['130B90EC-E4C7-43C1-BE0C-9E0A24E6ED6C', 'N/A', null],
  ['39F5DB17-8285-4FAA-BD5E-042C9A12C797', 'DELFAR', null],
  ['F22ABD15-9054-47E7-AB6C-9D66C2A7FFB0', 'SMEC', null],
  ['CDD322CD-817A-4910-8BB9-D07FB7394F38', 'AH&MET', null],
  ['0B375A1F-2E3F-435F-AAEE-344C9DB2BBF3', 'MELCO', null],
  ['69DEBCAC-BA1D-4D07-8E59-D6572B0585B0', 'AYHA', null],
  ['9E493A2B-D996-4680-A018-DD0663CDE4DA', 'KLEEMAN', null],
  ['6960C489-1957-4222-9504-1EF2A0E2FA1B', 'Wittur', null],
  ['A1BB8DA7-FB5C-4D8E-93DF-348BDD492F0C', 'Kone', null],
  ['072DA69D-E3F6-4765-9F95-0B1C76831652', 'Mitsubishi Heavy Industries (MHI)', null],
  ['9F004DB6-760A-4D8F-ACC2-0FC158D5CA2E', 'Toshiba', null],
  ['F411A3C3-8749-4967-81DD-F5C7BAFDC7F0', 'Carrier', null],
  ['B5F718E5-9338-4BE4-8639-2BDC164BA7B2', 'Yukselish', null],
  ['455CAD36-D16D-4356-90C4-E316036B3FBC', 'Midea', null],
  ['D20DEBC9-128B-43E2-853E-406DC634CC1A', '///', null],
  ['57B3F036-66F3-42B3-BEE1-F3BF7F813287', 'AYVAZ', '7E9D349F-8E1C-4600-A62A-14DC84C98DE7'],
  ['7CA6B688-0D3D-46D2-B03C-438424EC85A4', 'PROLIFT', 'A5B9DA95-9565-4797-9F3D-5B22B9995530'],
  ['CB52EFD4-7E5C-40A6-9159-14EA7DD3D38D', 'ONAY LIFT', null],
  ['526FD746-78DB-423E-BD98-1338F8338F87', 'Ozinan', '6FB16591-13EF-4060-A4B1-0008BAFAA182'],
  ['57E563E9-CFC1-4F9B-885E-C9C59F076275', 'OTIS', 'FABADEB3-EEE3-4794-A88D-18288AF415BF'],
  ['c4f116d4-8e28-4a98-8457-0d77522e9423', 'AKE', '74638752-caef-4e0d-99a1-674d349b278d']
];

(async () => {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  const remote = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });

  await local.connect();
  await remote.connect();

  console.log('📦 Inserting brands data...\n');

  for (const [uuid, name, counteragentUuid] of brandsData) {
    const counteragentUuids = counteragentUuid ? [counteragentUuid.toLowerCase()] : [];
    
    // Insert to local
    await local.query(
      `INSERT INTO brands (uuid, name, counteragent_uuids)
       VALUES ($1, $2, $3)
       ON CONFLICT (uuid) DO UPDATE SET 
         name = EXCLUDED.name,
         counteragent_uuids = EXCLUDED.counteragent_uuids`,
      [uuid.toLowerCase(), name, counteragentUuids]
    );
    
    // Insert to Supabase
    await remote.query(
      `INSERT INTO brands (uuid, name, counteragent_uuids)
       VALUES ($1, $2, $3)
       ON CONFLICT (uuid) DO UPDATE SET 
         name = EXCLUDED.name,
         counteragent_uuids = EXCLUDED.counteragent_uuids`,
      [uuid.toLowerCase(), name, counteragentUuids]
    );
    
    console.log(`✅ ${name.padEnd(35)} - ${counteragentUuids.length ? counteragentUuids[0].substring(0, 8) + '...' : 'no counteragent'}`);
  }

  // Verify counts
  const localCount = await local.query('SELECT COUNT(*) FROM brands');
  const remoteCount = await remote.query('SELECT COUNT(*) FROM brands');

  console.log('\n📊 Final counts:');
  console.log(`  Local: ${localCount.rows[0].count} brands`);
  console.log(`  Supabase: ${remoteCount.rows[0].count} brands`);

  await local.end();
  await remote.end();
})();
