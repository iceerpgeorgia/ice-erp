import fs from 'fs';
import { config } from 'dotenv';
import { prisma } from '../lib/prisma';

if (fs.existsSync('.env.local')) {
  config({ path: '.env.local' });
} else {
  config();
}

const tableName = 'GE78BG0000000893486000_BOG_GEL';
const dockey = '20424190037';

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, dockey, entriesid, counteragent_uuid, transaction_date, account_currency_amount, nominal_amount, account_currency_uuid
     FROM "${tableName}"
     WHERE dockey = $1 AND entriesid::text LIKE '%00000'
     LIMIT 1`,
    dockey
  );

  if (rows.length === 0) {
    console.log('No 00000-ending row found for dockey:', dockey);
    return;
  }

  const row = rows[0];
  console.log('Target row:', row);

  const matches = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, dockey, entriesid, counteragent_uuid, transaction_date, account_currency_amount, nominal_amount
     FROM "${tableName}"
     WHERE counteragent_uuid = $1::uuid
       AND transaction_date::date = $2::date
       AND account_currency_amount = $3
       AND (dockey <> $4 OR entriesid::text NOT LIKE '%00000')
     ORDER BY id ASC`,
    row.counteragent_uuid,
    row.transaction_date,
    row.account_currency_amount,
    dockey
  );

  console.log(`Matches with same counteragent/date/amount: ${matches.length}`);
  matches.forEach((m) => {
    console.log(`${m.id} | ${m.dockey} | ${m.entriesid} | ${m.transaction_date} | ${m.account_currency_amount}`);
  });
}

main()
  .catch((error) => {
    console.error('Failed to check:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });