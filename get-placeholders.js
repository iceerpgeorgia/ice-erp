const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

async function getPlaceholderData() {
  const projectUuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2';

  try {
    // Get project and linked data
    const result = await pool.query(`
      SELECT 
        p.project_uuid,
        p.project_name,
        p.department,
        p.address,
        p.date,
        p.counteragent_uuid,
        p.insider_uuid,
        c.name as counteragent_name,
        c.entity_type as counteragent_entity_type,
        c.director as counteragent_director,
        c.address_line_1 as counteragent_address_1,
        c.address_line_2 as counteragent_address_2,
        c.identification_number as counteragent_id,
        cu.code as currency_code,
        i.name as insider_name,
        i.entity_type as insider_entity_type,
        i.identification_number as insider_id,
        i.address_line_1 as insider_address_1,
        i.address_line_2 as insider_address_2,
        i.director as insider_director
      FROM projects p
      LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
      LEFT JOIN currencies cu ON p.currency_uuid = cu.uuid
      LEFT JOIN counteragents i ON p.insider_uuid = i.counteragent_uuid
      WHERE p.project_uuid = $1
    `, [projectUuid]);

    if (result.rows.length === 0) {
      console.error('Project not found:', projectUuid);
      await pool.end();
      return;
    }

    const row = result.rows[0];

    console.log('=== PLACEHOLDER DATA MAPPING FOR PROJECT ===');
    console.log('Project UUID:', row.project_uuid);
    console.log('');

    const placeholders = {
      'A1 (Project_Department)': row.department || 'N/A',
      'A2 (Handover_Date)': row.date ? row.date.toISOString().split('T')[0] : 'N/A',
      'A3 (Project_Counteragent_Entity_Type)': row.counteragent_entity_type || 'N/A',
      'A4 (Project_Counteragent_Name)': row.counteragent_name || 'N/A',
      'A5 (Project_Counteragent_Director_Genitive)': row.counteragent_director || 'N/A',
      'A6 (Project_Counteragent_Director)': row.counteragent_director || 'N/A',
      'A7 (Project_Counteragent_Address_Line_1)': row.counteragent_address_1 || 'N/A',
      'A8 (Project_Counteragent_Address_Line_2)': row.counteragent_address_2 || 'N/A',
      'A9 (Project_Counteragent_ID)': row.counteragent_id || 'N/A',
      'A10 (Project_Address)': row.address || 'N/A',
      'A11 (Project_Insider_Entity_Type)': row.insider_entity_type || 'N/A',
      'A12 (Project_Insider_Name)': row.insider_name || 'N/A',
      'A13 (Project_Insider_ID)': row.insider_id || 'N/A',
      'A14 (Project_Insider_Address_Line1)': row.insider_address_1 || 'N/A',
      'A15 (Project_Insider_Address_Line2)': row.insider_address_2 || 'N/A',
      'A16 (Project_Insider_Director_Genitive)': row.insider_director || 'N/A',
      'A17 (Project_Insider_Director_Normative)': row.insider_director || 'N/A',
      'A18 (Contract_Date)': row.date ? row.date.toISOString().split('T')[0] : 'N/A',
      'A19 (Project_Currency)': row.currency_code || 'N/A',
    };

    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ PLACEHOLDER MAPPING                                     │');
    console.log('├─────────────────────────────────────────────────────────┤');
    Object.entries(placeholders).forEach(([key, value]) => {
      console.log(`│ ${key.padEnd(35)} │ ${String(value).substring(0, 20).padEnd(20)} │`);
    });
    console.log('└─────────────────────────────────────────────────────────┘');

    console.log('');
    console.log('=== RAW DATA (for debugging) ===');
    console.log(JSON.stringify(row, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

getPlaceholderData();
