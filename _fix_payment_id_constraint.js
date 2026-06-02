/**
 * Modifies payments_payment_id_format_check to also allow WB-{digits} format
 * used by waybill-derived payments.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  console.log('Dropping old constraint...');
  await p.$executeRawUnsafe(`
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_id_format_check
  `);

  console.log('Creating new constraint allowing hex format OR WB-{digits}...');
  await p.$executeRawUnsafe(`
    ALTER TABLE payments ADD CONSTRAINT payments_payment_id_format_check
      CHECK (
        payment_id ~ '^[0-9a-f]{6}_[0-9a-f]{2}_[0-9a-f]{6}$'
        OR payment_id ~ '^WB-[0-9]+$'
      )
  `);

  console.log('Done.');
}

run()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
