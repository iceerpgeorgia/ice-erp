BigInt.prototype.toJSON = function () { return Number(this); };
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const caUuid = 'c309cb7c-404d-431a-a8fb-29671dca0c49';
  const fcUuid = '319b2a70-b446-41f6-9f39-a3dfb1082786';

  const sa = await p.$queryRawUnsafe(
    `SELECT payment_id, salary_month, net_sum, created_at
     FROM salary_accruals
     WHERE counteragent_uuid = $1::uuid AND financial_code_uuid = $2::uuid
     ORDER BY salary_month DESC LIMIT 6`,
    caUuid, fcUuid
  );
  console.log('Recent salary accruals for David Nadiradze FC 3.1.1:', JSON.stringify(sa, null, 2));

  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
