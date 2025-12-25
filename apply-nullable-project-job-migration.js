const { Client } = require('pg');

async function applyMigration() {
  const databases = [
    {
      name: 'LOCAL',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'ICE_ERP',
        user: 'postgres',
        password: 'fulebimojviT1985%'
      }
    },
    {
      name: 'SUPABASE',
      config: {
        host: 'aws-1-eu-west-1.pooler.supabase.com',
        port: 6543,
        database: 'postgres',
        user: 'postgres.fojbzghphznbslqwurrm',
        password: 'fulebimojviT1985%'
      }
    }
  ];

  const migrationSQL = `
-- Make project_uuid and job_uuid nullable in payments
ALTER TABLE payments ALTER COLUMN project_uuid DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN job_uuid DROP NOT NULL;
`;

  for (const db of databases) {
    const client = new Client(db.config);
    
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Connecting to ${db.name}...`);
      await client.connect();
      console.log('✓ Connected');

      console.log(`\nApplying migration to ${db.name}...`);
      await client.query(migrationSQL);
      console.log('✓ Migration applied successfully');

      // Verify the columns are now nullable
      const verifyResult = await client.query(`
        SELECT 
          column_name,
          is_nullable,
          data_type
        FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name IN ('project_uuid', 'job_uuid')
        ORDER BY column_name
      `);
      
      console.log('\n✓ Verification:');
      for (const row of verifyResult.rows) {
        console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      }

    } catch (error) {
      console.error(`✗ Error applying migration to ${db.name}:`, error.message);
    } finally {
      await client.end();
      console.log(`✓ Disconnected from ${db.name}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Migration complete!');
  process.exit(0);
}

applyMigration();
