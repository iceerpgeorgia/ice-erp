const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const limit = 10;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT cba.*,
            ba.account_number,
            b.bank_name,
            ca.counteragent as counteragent_name,
            p.project_index,
            fc.validation as financial_code,
            curr_acc.code as account_currency_code,
            curr_nom.code as nominal_currency_code
     FROM "consolidated_bank_accounts" cba
     LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
     LEFT JOIN banks b ON ba.bank_uuid = b.uuid
     LEFT JOIN counteragents ca ON cba.counteragent_uuid = ca.counteragent_uuid
     LEFT JOIN projects p ON cba.project_uuid = p.project_uuid
     LEFT JOIN financial_codes fc ON cba.financial_code_uuid = fc.uuid
     LEFT JOIN currencies curr_acc ON cba.account_currency_uuid = curr_acc.uuid
     LEFT JOIN currencies curr_nom ON cba.nominal_currency_uuid = curr_nom.uuid
     ORDER BY cba.transaction_date DESC, cba.id DESC
     LIMIT ${limit}`
  );
  console.log('rows', rows.length);
}

run()
  .catch(error => {
    console.error('Error:', error.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
