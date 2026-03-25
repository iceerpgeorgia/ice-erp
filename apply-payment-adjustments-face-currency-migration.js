const { Client } = require('pg');

async function run() {
  const url = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
  const client = new Client({ connectionString: url });
  await client.connect();

  // Add face currency columns to payment_adjustments
  await client.query(`
    ALTER TABLE payment_adjustments
      ADD COLUMN IF NOT EXISTS face_currency_code TEXT,
      ADD COLUMN IF NOT EXISTS face_amount DECIMAL(18,2),
      ADD COLUMN IF NOT EXISTS manual_rate DECIMAL(18,6),
      ADD COLUMN IF NOT EXISTS nominal_amount DECIMAL(18,2);
  `);

  // Backfill: set nominal_amount = amount for existing rows
  await client.query(`
    UPDATE payment_adjustments
    SET nominal_amount = amount
    WHERE nominal_amount IS NULL;
  `);

  console.log('payment_adjustments face currency columns added successfully');
  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
