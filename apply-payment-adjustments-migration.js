const { Client } = require('pg');

async function run() {
  const url = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
  const client = new Client({ connectionString: url });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS payment_adjustments (
      id BIGSERIAL PRIMARY KEY,
      payment_id TEXT NOT NULL,
      effective_date TIMESTAMP NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      comment TEXT,
      record_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
      user_email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      insider_uuid UUID,
      CONSTRAINT fk_payment_adjustment_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE CASCADE ON UPDATE NO ACTION
    );
    CREATE INDEX IF NOT EXISTS idx_payment_adjustments_effective_date ON payment_adjustments(effective_date);
    CREATE INDEX IF NOT EXISTS idx_payment_adjustments_insider_uuid ON payment_adjustments(insider_uuid);
    CREATE INDEX IF NOT EXISTS idx_payment_adjustments_payment_id ON payment_adjustments(payment_id);
  `);

  console.log('payment_adjustments table created successfully');
  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
