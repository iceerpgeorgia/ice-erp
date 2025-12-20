const { Client } = require('pg');

(async () => {
  const c = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });
  
  await c.connect();
  
  // First, find projects that have employees
  const matched = await c.query(`
    SELECT 
      p.id, 
      p.project_uuid, 
      p.project_name, 
      pe.employee_uuid, 
      ca.name as employee_name 
    FROM projects p 
    JOIN project_employees pe ON p.project_uuid = pe.project_uuid 
    JOIN counteragents ca ON pe.employee_uuid = ca.counteragent_uuid 
    LIMIT 5
  `);
  
  console.log('=== INNER JOIN TEST (should find matches) ===');
  console.log('Matched projects:', matched.rows.length);
  matched.rows.forEach(row => {
    console.log('Project:', row.project_name, '-> Employee:', row.employee_name);
  });
  
  // Now test the API query with projects that SHOULD have employees
  const r = await c.query(`
    SELECT 
      p.id, 
      p.project_name, 
      ARRAY_AGG(
        JSON_BUILD_OBJECT(
          'employeeUuid', pe.employee_uuid, 
          'employeeName', c.name
        )
      ) FILTER (WHERE pe.employee_uuid IS NOT NULL) as employees 
    FROM projects p 
    LEFT JOIN project_employees pe ON p.project_uuid = pe.project_uuid 
    LEFT JOIN counteragents c ON pe.employee_uuid = c.counteragent_uuid 
    WHERE p.id IN (185, 188, 189, 190, 191)
    GROUP BY p.id 
    ORDER BY p.id
  `);
  
  console.log('\n=== API QUERY TEST (with ARRAY_AGG on projects that have employees) ===');
  r.rows.forEach(p => {
    console.log('\nID:', p.id);
    console.log('Name:', p.project_name?.substring(0, 50));
    console.log('Employees:', p.employees);
  });
  
  await c.end();
})();
