const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const financialCodeUuids = [
    '31562b13-85c8-472e-8d02-01d802d635c1',
    '12238130-9d12-4099-a48b-9eb5a085e0f8',
    'c491bff3-6f7b-4412-9df0-eaed6f3ee238'
  ];

  const query = `
    WITH selected_payments AS (
      SELECT p.payment_id, p.project_uuid
      FROM payments p
      WHERE p.is_active = true
        AND p.financial_code_uuid IN (${financialCodeUuids.map((_, i) => `$${i + 1}::uuid`).join(', ')})
    ),
    cost_data AS (
      SELECT
        p.project_uuid,
        STRING_AGG(DISTINCT p.payment_id, ',') FILTER (WHERE p.payment_id IS NOT NULL) as cost_payment_ids_str,
        MAX(c.uuid) as project_currency_uuid,
        COALESCE(MAX(c.code), 'GEL') as project_currency_code
      FROM payments p
      JOIN payments_ledger pl ON pl.payment_id = p.payment_id
      JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
      LEFT JOIN currencies c ON c.uuid = p.currency_uuid
      WHERE p.is_active = true
        AND fc.is_income = false
        AND fc.applies_to_pl = true
        AND (pl.is_deleted = false OR pl.is_deleted IS NULL)
        AND p.project_uuid IN (SELECT DISTINCT project_uuid FROM selected_payments)
      GROUP BY p.project_uuid
    )
    SELECT
      sp.project_uuid,
      COALESCE(MAX(cd.project_currency_uuid), NULL) as project_currency_uuid,
      COALESCE(MAX(cd.project_currency_code), 'GEL') as project_currency_code,
      ARRAY_REMOVE(STRING_TO_ARRAY(MAX(cd.cost_payment_ids_str), ','), '')::text[] as cost_payment_ids
    FROM selected_payments sp
    LEFT JOIN cost_data cd ON sp.project_uuid = cd.project_uuid
    GROUP BY sp.project_uuid
    LIMIT 20
  `;

  const rows = await prisma.$queryRawUnsafe(query, ...financialCodeUuids);
  console.log('Rows:', rows.length);
  console.log(rows.slice(0, 3));
}

main()
  .catch((e) => {
    console.error('DEBUG ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
