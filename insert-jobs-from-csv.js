const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read CSV file
const csvContent = fs.readFileSync(path.join(__dirname, 'jobs.csv'), 'utf-8');
const lines = csvContent.trim().split('\n');
const header = lines[0].split(',');

// Parse CSV
const jobs = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  // Handle potential commas in quoted fields and newlines in data
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
  
  // Skip if not enough values or incomplete line
  if (values.length < 7) continue;
  
  jobs.push({
    project_uuid: values[0],
    job_name: values[1],
    job_uuid: values[2],
    floors: values[3] || null,
    weight: values[4] || null,
    is_ff: values[5] ? (values[5].toUpperCase() === 'TRUE') : false,
    brand: values[6] || null
  });
}

console.log(`Parsed ${jobs.length} jobs from CSV`);

async function insertJobs(dbUrl, dbName) {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`\n=== Processing ${dbName} ===`);
    
    // Get brand mapping by UUID and by name
    const brandResult = await client.query('SELECT uuid, name FROM brands WHERE is_active = true');
    const brandMapByUuid = new Map();
    const brandMapByName = new Map();
    brandResult.rows.forEach(row => {
      brandMapByUuid.set(row.uuid, row.uuid);
      brandMapByName.set(row.name.toLowerCase(), row.uuid);
    });
    
    // Get N/A brand UUID for jobs without brands
    const naBrandUuid = brandMapByName.get('n/a');
    console.log(`Found ${brandResult.rows.length} brands, N/A brand UUID: ${naBrandUuid}`);
    
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const job of jobs) {
      try {
        // Determine brand_uuid
        let brandUuid = naBrandUuid; // Default to N/A
        if (job.brand && job.brand.trim()) {
          const brandValue = job.brand.trim();
          
          // Check if it's a UUID (has dashes in the right format)
          if (brandValue.includes('-') && brandValue.length > 30) {
            // It's a UUID, check if it exists in brands table
            if (brandMapByUuid.has(brandValue)) {
              brandUuid = brandValue;
            } else {
              console.log(`Warning: Brand UUID "${brandValue}" not found for job ${job.job_name}, using N/A`);
            }
          } else {
            // It's a brand name, look it up
            const brandName = brandValue.toLowerCase();
            if (brandMapByName.has(brandName)) {
              brandUuid = brandMapByName.get(brandName);
            } else {
              console.log(`Warning: Brand name "${brandValue}" not found for job ${job.job_name}, using N/A`);
            }
          }
        }
        
        // Parse numeric values
        const floors = job.floors ? parseInt(job.floors) : null;
        const weight = job.weight ? parseInt(job.weight) : null;
        
        // Insert job
        await client.query(`
          INSERT INTO jobs (project_uuid, job_name, job_uuid, floors, weight, is_ff, brand_uuid, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          ON CONFLICT (job_uuid) DO NOTHING
        `, [job.project_uuid, job.job_name, job.job_uuid, floors, weight, job.is_ff, brandUuid]);
        
        inserted++;
        if (inserted % 50 === 0) {
          console.log(`Inserted ${inserted} jobs...`);
        }
      } catch (err) {
        errors++;
        console.error(`Error inserting job ${job.job_name}:`, err.message);
      }
    }
    
    console.log(`\nCompleted ${dbName}:`);
    console.log(`- Inserted: ${inserted}`);
    console.log(`- Errors: ${errors}`);
    
  } catch (error) {
    console.error(`Error processing ${dbName}:`, error);
  } finally {
    await client.end();
  }
}

// Run for both databases
(async () => {
  const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
  const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';
  
  await insertJobs(LOCAL, 'LOCAL');
  await insertJobs(SUPABASE, 'SUPABASE');
  
  console.log('\n=== All done! ===');
})();
