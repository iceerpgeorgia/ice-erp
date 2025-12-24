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
-- Add comment column to payments_ledger
ALTER TABLE payments_ledger ADD COLUMN IF NOT EXISTS comment TEXT;
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

      // Verify the column was added
      const verifyResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'payments_ledger' 
        AND column_name = 'comment'
      `);
      
      if (verifyResult.rows.length > 0) {
        console.log('✓ Verified: comment column exists');
        console.log(`  Type: ${verifyResult.rows[0].data_type}`);
      } else {
        console.log('✗ Warning: comment column not found after migration');
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
