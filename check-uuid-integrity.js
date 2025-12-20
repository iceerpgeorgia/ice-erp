const { Client } = require('pg');
const fs = require('fs');

async function checkIntegrity(connectionString, dbName) {
  const client = new Client({ connectionString });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Checking UUID Integrity: ${dbName}`);
  console.log('='.repeat(80));
  
  try {
    await client.connect();
    
    const checks = [
      {
        name: 'Projects -> Counteragents',
        query: `
          SELECT COUNT(*) as count
          FROM projects p
          LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
          WHERE p.counteragent_uuid IS NOT NULL AND c.counteragent_uuid IS NULL
        `,
        detailQuery: `
          SELECT p.id, p.project_name, p.counteragent_uuid, p.counteragent AS cached_name
          FROM projects p
          LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
          WHERE p.counteragent_uuid IS NOT NULL AND c.counteragent_uuid IS NULL
          ORDER BY p.id LIMIT 10
        `
      },
      {
        name: 'Projects -> Financial Codes',
        query: `
          SELECT COUNT(*) as count
          FROM projects p
          LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
          WHERE p.financial_code_uuid IS NOT NULL AND fc.uuid IS NULL
        `,
        detailQuery: `
          SELECT p.id, p.project_name, p.financial_code_uuid, p.financial_code AS cached_code
          FROM projects p
          LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
          WHERE p.financial_code_uuid IS NOT NULL AND fc.uuid IS NULL
          ORDER BY p.id LIMIT 10
        `
      },
      {
        name: 'Projects -> Currencies',
        query: `
          SELECT COUNT(*) as count
          FROM projects p
          LEFT JOIN currencies cur ON p.currency_uuid = cur.uuid
          WHERE p.currency_uuid IS NOT NULL AND cur.uuid IS NULL
        `,
        detailQuery: `
          SELECT p.id, p.project_name, p.currency_uuid, p.currency AS cached_currency
          FROM projects p
          LEFT JOIN currencies cur ON p.currency_uuid = cur.uuid
          WHERE p.currency_uuid IS NOT NULL AND cur.uuid IS NULL
          ORDER BY p.id LIMIT 10
        `
      },
      {
        name: 'Projects -> States',
        query: `
          SELECT COUNT(*) as count
          FROM projects p
          LEFT JOIN project_states ps ON p.state_uuid = ps.uuid
          WHERE p.state_uuid IS NOT NULL AND ps.uuid IS NULL
        `,
        detailQuery: `
          SELECT p.id, p.project_name, p.state_uuid, p.state AS cached_state
          FROM projects p
          LEFT JOIN project_states ps ON p.state_uuid = ps.uuid
          WHERE p.state_uuid IS NOT NULL AND ps.uuid IS NULL
          ORDER BY p.id LIMIT 10
        `
      },
      {
        name: 'Project Employees -> Projects',
        query: `
          SELECT COUNT(*) as count
          FROM project_employees pe
          LEFT JOIN projects p ON pe.project_uuid = p.project_uuid
          WHERE pe.project_uuid IS NOT NULL AND p.project_uuid IS NULL
        `,
        detailQuery: `
          SELECT pe.id, pe.project_uuid, pe.employee_uuid
          FROM project_employees pe
          LEFT JOIN projects p ON pe.project_uuid = p.project_uuid
          WHERE pe.project_uuid IS NOT NULL AND p.project_uuid IS NULL
          ORDER BY pe.id LIMIT 10
        `
      },
      {
        name: 'Project Employees -> Counteragents',
        query: `
          SELECT COUNT(*) as count
          FROM project_employees pe
          LEFT JOIN counteragents c ON pe.employee_uuid = c.counteragent_uuid
          WHERE pe.employee_uuid IS NOT NULL AND c.counteragent_uuid IS NULL
        `,
        detailQuery: `
          SELECT pe.id, pe.project_uuid, pe.employee_uuid
          FROM project_employees pe
          LEFT JOIN counteragents c ON pe.employee_uuid = c.counteragent_uuid
          WHERE pe.employee_uuid IS NOT NULL AND c.counteragent_uuid IS NULL
          ORDER BY pe.id LIMIT 10
        `
      },
      {
        name: 'Counteragents -> Countries',
        query: `
          SELECT COUNT(*) as count
          FROM counteragents c
          LEFT JOIN countries co ON c.country_uuid = co.country_uuid
          WHERE c.country_uuid IS NOT NULL AND co.country_uuid IS NULL
        `,
        detailQuery: `
          SELECT c.id, c.counteragent, c.country_uuid, c.country AS cached_country
          FROM counteragents c
          LEFT JOIN countries co ON c.country_uuid = co.country_uuid
          WHERE c.country_uuid IS NOT NULL AND co.country_uuid IS NULL
          ORDER BY c.id LIMIT 10
        `
      },
      {
        name: 'Counteragents -> Entity Types',
        query: `
          SELECT COUNT(*) as count
          FROM counteragents c
          LEFT JOIN entity_types et ON c.entity_type_uuid = et.entity_type_uuid
          WHERE c.entity_type_uuid IS NOT NULL AND et.entity_type_uuid IS NULL
        `,
        detailQuery: `
          SELECT c.id, c.counteragent, c.entity_type_uuid, c.entity_type AS cached_entity_type
          FROM counteragents c
          LEFT JOIN entity_types et ON c.entity_type_uuid = et.entity_type_uuid
          WHERE c.entity_type_uuid IS NOT NULL AND et.entity_type_uuid IS NULL
          ORDER BY c.id LIMIT 10
        `
      }
    ];

    let totalIssues = 0;
    const summary = [];

    for (const check of checks) {
      const result = await client.query(check.query);
      const count = parseInt(result.rows[0].count);
      totalIssues += count;
      summary.push({ check: check.name, issues: count });

      if (count > 0) {
        console.log(`\n❌ ${check.name}: ${count} issue(s) found`);
        const details = await client.query(check.detailQuery);
        console.log('   Sample records:');
        details.rows.forEach((row, idx) => {
          console.log(`   ${idx + 1}.`, JSON.stringify(row, null, 2).replace(/\n/g, '\n      '));
        });
      } else {
        console.log(`\n✅ ${check.name}: OK`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    summary.forEach(s => {
      const status = s.issues === 0 ? '✅' : '❌';
      console.log(`${status} ${s.check.padEnd(40)} ${s.issues} issue(s)`);
    });
    console.log('='.repeat(80));
    console.log(`Total issues found: ${totalIssues}`);
    console.log('='.repeat(80));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

async function main() {
  // Check local database
  await checkIntegrity('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP', 'LOCAL');

  // Check Supabase database
  const supabaseUrl = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';
  await checkIntegrity(supabaseUrl, 'SUPABASE');
}

main().catch(console.error);
