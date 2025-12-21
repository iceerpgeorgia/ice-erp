const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';

// Read CSV file
const csvContent = fs.readFileSync(path.join(__dirname, 'jobs.csv'), 'utf-8');
const lines = csvContent.trim().split('\n');
const header = lines[0].split(',');

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
  
  jobs.push({
    project_uuid: values[0] || null,
    job_name: values[1] || null,
    job_uuid: values[2] || null,
    floors: values[3] || null,
    weight: values[4] || null,
    is_ff: values[5] ? (values[5].toUpperCase() === 'TRUE') : false,
    brand: values[6] || null
  });
}

console.log(`Parsed ${jobs.length} jobs from CSV`);

async function findAndInsertMissing(dbUrl, dbName) {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`\n=== Processing ${dbName} ===`);
    
    // Get existing job_uuids from database
    const existingResult = await client.query('SELECT job_uuid FROM jobs');
    const existingUuids = new Set(existingResult.rows.map(row => row.job_uuid));
    console.log(`Found ${existingUuids.size} existing jobs in database`);
    
    // Get brand mapping
    const brandResult = await client.query('SELECT uuid, name FROM brands WHERE is_active = true');
    const brandMapByUuid = new Map();
    const brandMapByName = new Map();
    brandResult.rows.forEach(row => {
      brandMapByUuid.set(row.uuid, row.uuid);
      brandMapByName.set(row.name.toLowerCase(), row.uuid);
    });
    
    const naBrandUuid = brandMapByName.get('n/a');
    
    // Find missing jobs
    const missingJobs = jobs.filter(job => !existingUuids.has(job.job_uuid));
    console.log(`Found ${missingJobs.length} missing jobs to insert`);
    
    if (missingJobs.length === 0) {
      console.log('No missing jobs - database is in sync with CSV');
      return;
    }
    
    let inserted = 0;
    let errors = 0;
    
    for (const job of missingJobs) {
      try {
        // Determine brand_uuid
        let brandUuid = naBrandUuid;
        if (job.brand && job.brand.trim()) {
          const brandValue = job.brand.trim();
          
          if (brandValue.includes('-') && brandValue.length > 30) {
            if (brandMapByUuid.has(brandValue)) {
              brandUuid = brandValue;
            } else {
              console.log(`Warning: Brand UUID "${brandValue}" not found for job ${job.job_name}, using N/A`);
            }
          } else {
            const brandName = brandValue.toLowerCase();
            if (brandMapByName.has(brandName)) {
              brandUuid = brandMapByName.get(brandName);
            } else {
              console.log(`Warning: Brand name "${brandValue}" not found for job ${job.job_name}, using N/A`);
            }
          }
        }
        
        const floors = job.floors ? parseInt(job.floors) : null;
        const weight = job.weight ? parseInt(job.weight) : null;
        
        await client.query(`
          INSERT INTO jobs (project_uuid, job_name, job_uuid, floors, weight, is_ff, brand_uuid, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        `, [job.project_uuid, job.job_name, job.job_uuid, floors, weight, job.is_ff, brandUuid]);
        
        inserted++;
        console.log(`Inserted: ${job.job_name} (${job.job_uuid})`);
      } catch (error) {
        errors++;
        console.error(`Error inserting job ${job.job_name}:`, error.message);
      }
    }
    
    console.log(`\nCompleted ${dbName}:`);
    console.log(`- Inserted: ${inserted}`);
    console.log(`- Errors: ${errors}`);
    
    const finalCount = await client.query('SELECT COUNT(*) FROM jobs');
    console.log(`- Total jobs in database: ${finalCount.rows[0].count}`);
    
  } catch (error) {
    console.error(`Error processing ${dbName}:`, error);
  } finally {
    await client.end();
  }
}

(async () => {
  await findAndInsertMissing(LOCAL, 'LOCAL');
  await findAndInsertMissing(SUPABASE, 'SUPABASE');
  console.log('\n=== All done! ===');
})();
