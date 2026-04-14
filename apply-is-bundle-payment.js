const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function run() {
  await p.$executeRawUnsafe("ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_bundle_payment BOOLEAN NOT NULL DEFAULT false");
  await p.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS payments_is_bundle_payment_idx ON payments(is_bundle_payment) WHERE is_bundle_payment = true");
  console.log("Migration applied");
  await p.$disconnect();
}
run().catch(e => { console.error(e.message); p.$disconnect(); });
