const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read CSV file
const csvContent = fs.readFileSync(path.join(__dirname, 'Jobs.csv'), 'utf-8');
const lines = csvContent.trim().split('\n');

// Parse CSV
const jobs = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  if (values.length < 7) continue;
  
  jobs.push({
    job_uuid: values[2],
    brand: values[6] || null
  });
}

console.log(`Parsed ${jobs.length} jobs from CSV`);

async function updateBrands(dbUrl, dbName) {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`\n=== Updating ${dbName} ===`);
    
    // Get brand mapping
    const brandResult = await client.query('SELECT uuid, name FROM brands WHERE is_active = true');
    const brandMapByUuid = new Map();
    const brandMapByName = new Map();
    brandResult.rows.forEach(row => {
      brandMapByUuid.set(row.uuid, row.uuid);
      brandMapByName.set(row.name.toLowerCase(), row.uuid);
    });
    
    const naBrandUuid = brandMapByName.get('n/a');
    console.log(`Found ${brandResult.rows.length} brands, N/A UUID: ${naBrandUuid}`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const job of jobs) {
      let brandUuid = naBrandUuid;
      
      if (job.brand && job.brand.trim()) {
        const brandValue = job.brand.trim();
        
        // Check if it's a UUID
        if (brandValue.includes('-') && brandValue.length > 30) {
          if (brandMapByUuid.has(brandValue)) {
            brandUuid = brandValue;
          }
        } else {
          // It's a brand name
          const brandName = brandValue.toLowerCase();
          if (brandMapByName.has(brandName)) {
            brandUuid = brandMapByName.get(brandName);
          }
        }
      }
      
      try {
        const result = await client.query(`
          UPDATE jobs 
          SET brand_uuid = $1 
          WHERE job_uuid = $2
        `, [brandUuid, job.job_uuid]);
        
        if (result.rowCount > 0) {
          updated++;
          if (updated % 50 === 0) {
            console.log(`Updated ${updated} jobs...`);
          }
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Error updating job ${job.job_uuid}:`, err.message);
      }
    }
    
    console.log(`\nCompleted ${dbName}:`);
    console.log(`- Updated: ${updated}`);
    console.log(`- Skipped: ${skipped}`);
    
  } catch (error) {
    console.error(`Error processing ${dbName}:`, error);
  } finally {
    await client.end();
  }
}

(async () => {
  const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
  const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';
  
  await updateBrands(LOCAL, 'LOCAL');
  await updateBrands(SUPABASE, 'SUPABASE');
  
  console.log('\n=== All done! ===');
})();
