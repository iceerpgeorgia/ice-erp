require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function testAPI() {
  const client = new Client({
    connectionString: process.env.REMOTE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Testing projects API query...\n');
    
    const result = await client.query(`
      SELECT 
        p.*,
        ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'employeeUuid', pe.employee_uuid,
            'employeeName', c.name
          )
        ) FILTER (WHERE pe.employee_uuid IS NOT NULL) as employees
      FROM projects p
      LEFT JOIN project_employees pe ON p.project_uuid = pe.project_uuid
      LEFT JOIN counteragents c ON pe.employee_uuid = c.counteragent_uuid
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 3
    `);
    
    console.log(`Found ${result.rows.length} projects`);
    console.log('\nFirst project:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

testAPI();
