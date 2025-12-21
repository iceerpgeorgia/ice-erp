const { Client } = require('pg');

async function fixProjectIndex(dbUrl, dbName) {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`\n=== Updating ${dbName} ===`);
    
    // Update the trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION populate_project_index()
      RETURNS TRIGGER AS $$
      DECLARE
        counteragent_name TEXT;
        fin_code TEXT;
        currency_code TEXT;
        formatted_value TEXT;
        formatted_date TEXT;
      BEGIN
        -- Get counteragent name
        SELECT name INTO counteragent_name
        FROM counteragents
        WHERE counteragent_uuid = NEW.counteragent_uuid;
        
        -- Get financial code
        SELECT code INTO fin_code
        FROM financial_codes
        WHERE uuid = NEW.financial_code_uuid;
        
        -- Get currency code
        SELECT code INTO currency_code
        FROM currencies
        WHERE uuid = NEW.currency_uuid;
        
        -- Format value with thousands separator
        formatted_value := TO_CHAR(NEW.value, 'FM999,999,999,999.00');
        
        -- Format date as dd.mm.yyyy
        formatted_date := TO_CHAR(NEW.date, 'DD.MM.YYYY');
        
        -- Compute project_index with proper separators
        NEW.project_index := NEW.project_name || ' | ' || 
                             COALESCE(fin_code, '') || ' | ' || 
                             COALESCE(counteragent_name, '') || ' | ' || 
                             formatted_value || ' | ' || 
                             COALESCE(currency_code, '') || ' | ' || 
                             formatted_date;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('Updated trigger function');
    
    // Drop trigger if exists
    await client.query(`
      DROP TRIGGER IF EXISTS set_project_index ON projects;
    `);
    
    // Create trigger
    await client.query(`
      CREATE TRIGGER set_project_index
      BEFORE INSERT OR UPDATE ON projects
      FOR EACH ROW
      EXECUTE FUNCTION populate_project_index();
    `);
    
    console.log('Created trigger');
    
    // Trigger update for all projects
    const result = await client.query(`
      UPDATE projects
      SET project_name = project_name
    `);
    
    console.log(`Updated ${result.rowCount} projects`);
    
    // Show a sample
    const sample = await client.query(`
      SELECT project_index 
      FROM projects 
      WHERE project_index IS NOT NULL 
      LIMIT 3
    `);
    
    console.log('\nSample project_index values:');
    sample.rows.forEach(row => {
      console.log(`- ${row.project_index}`);
    });
    
  } catch (error) {
    console.error(`Error updating ${dbName}:`, error);
  } finally {
    await client.end();
  }
}

(async () => {
  const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
  const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';
  
  await fixProjectIndex(LOCAL, 'LOCAL');
  await fixProjectIndex(SUPABASE, 'SUPABASE');
  
  console.log('\n=== All done! ===');
})();
