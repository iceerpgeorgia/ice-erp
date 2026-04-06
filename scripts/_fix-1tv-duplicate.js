BigInt.prototype.toJSON = function () { return Number(this); };
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const deactivate = await p.$queryRawUnsafe(
    `UPDATE payments
     SET is_active = false, is_project_derived = false, updated_at = NOW()
     WHERE payment_id = '50861b_06_d6a9e2'
     RETURNING payment_id, is_active, is_project_derived`
  );
  console.log('Deactivated + unmarked auto:', JSON.stringify(deactivate));

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
