const { Client } = require('pg');

async function testPayment() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  try {
    // Get a sample project, counteragent (if any), financial code, and job
    const project = await local.query(`
      SELECT project_uuid FROM projects LIMIT 1
    `);
    
    const financialCode = await local.query(`
      SELECT uuid FROM financial_codes WHERE is_active = true LIMIT 1
    `);
    
    const job = await local.query(`
      SELECT job_uuid FROM jobs WHERE is_active = true LIMIT 1
    `);
    
    if (project.rows.length === 0 || financialCode.rows.length === 0 || job.rows.length === 0) {
      console.log('Not enough data to create test payment');
      console.log('Projects:', project.rows.length);
      console.log('Financial codes:', financialCode.rows.length);
      console.log('Jobs:', job.rows.length);
      await local.end();
      return;
    }
    
    // Use a dummy counteragent UUID since we have 0 counteragents
    const dummyCounteragentUuid = '00000000-0000-0000-0000-000000000000';
    
    console.log('Creating test payment with:');
    console.log('Project UUID:', project.rows[0].project_uuid);
    console.log('Counteragent UUID:', dummyCounteragentUuid);
    console.log('Financial Code UUID:', financialCode.rows[0].uuid);
    console.log('Job UUID:', job.rows[0].job_uuid);
    
    // Insert test payment
    const result = await local.query(`
      INSERT INTO payments (
        project_uuid,
        counteragent_uuid,
        financial_code_uuid,
        job_uuid,
        payment_id,
        record_uuid,
        updated_at
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        '',
        '',
        NOW()
      )
      RETURNING *
    `, [
      project.rows[0].project_uuid,
      dummyCounteragentUuid,
      financialCode.rows[0].uuid,
      job.rows[0].job_uuid
    ]);
    
    console.log('\n✓ Payment created successfully!');
    console.log('Payment ID:', result.rows[0].payment_id);
    console.log('Record UUID:', result.rows[0].record_uuid);
    console.log('\nFull record:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await local.end();
  }
}

testPayment().catch(console.error);
