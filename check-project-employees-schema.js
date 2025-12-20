const { Client } = require('pg');

async function checkSchema() {
  // Load from .env.local
  require('dotenv').config({ path: '.env.local' });
  
  const client = new Client({
    connectionString: process.env.REMOTE_DATABASE_URL
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'project_employees' 
      ORDER BY ordinal_position
    `);
    
    console.log('project_employees columns:');
    console.log(JSON.stringify(result.rows, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
