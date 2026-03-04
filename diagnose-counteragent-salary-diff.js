const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TARGET_INN = '01030009562';
const RAW_BANK_UNION = `
  SELECT
    cba.payment_id,
    cba.nominal_currency_uuid,
    cba.nominal_amount
  FROM "GE78BG0000000893486000_BOG_GEL" cba
  WHERE NOT EXISTS (
    SELECT 1 FROM bank_transaction_batches btb
    WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
  )
  AND cba.payment_id NOT ILIKE 'BTC_%'

  UNION ALL

  SELECT
    t.payment_id,
    t.nominal_currency_uuid,
    t.nominal_amount
  FROM "GE65TB7856036050100002_TBC_GEL" t
  WHERE NOT EXISTS (
    SELECT 1 FROM bank_transaction_batches btb
    WHERE btb.raw_record_uuid::text = t.raw_record_uuid::text
  )
  AND t.payment_id NOT ILIKE 'BTC_%'

  UNION ALL

  SELECT
    COALESCE(
      CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
      p.payment_id
    ) as payment_id,
    COALESCE(btb.nominal_currency_uuid, p.currency_uuid, cba.nominal_currency_uuid) as nominal_currency_uuid,
    COALESCE(btb.nominal_amount, btb.partition_amount) as nominal_amount
  FROM "GE78BG0000000893486000_BOG_GEL" cba
  JOIN bank_transaction_batches btb
    ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
  LEFT JOIN payments p
    ON (
      btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
    ) OR (
      btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
    )

  UNION ALL

  SELECT
    COALESCE(
      CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
      p.payment_id
    ) as payment_id,
    COALESCE(btb.nominal_currency_uuid, p.currency_uuid, t.nominal_currency_uuid) as nominal_currency_uuid,
    COALESCE(btb.nominal_amount, btb.partition_amount) as nominal_amount
  FROM "GE65TB7856036050100002_TBC_GEL" t
  JOIN bank_transaction_batches btb
    ON btb.raw_record_uuid::text = t.raw_record_uuid::text
  LEFT JOIN payments p
    ON (
      btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
    ) OR (
      btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
    )
`;

const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizePaymentKey = (value) => {
  const trimmed = String(value || '').trim();
  const base = trimmed.includes(':') ? trimmed.split(':')[0] : trimmed;
  return base.toLowerCase();
};

async function main() {
  const counteragents = await prisma.$queryRawUnsafe(
    `SELECT counteragent_uuid, counteragent, identification_number
     FROM counteragents
     WHERE identification_number = $1
     LIMIT 5`,
    TARGET_INN
  );

  if (!counteragents.length) {
    console.log(JSON.stringify({ error: 'Counteragent not found', targetInn: TARGET_INN }, null, 2));
    return;
  }

  const counteragent = counteragents[0];

  const accruals = await prisma.$queryRawUnsafe(
    `SELECT id, payment_id, nominal_currency_uuid, salary_month, net_sum
     FROM salary_accruals
     WHERE counteragent_uuid = $1::uuid
     ORDER BY salary_month DESC, id DESC`,
    counteragent.counteragent_uuid
  );

  const paidRows = await prisma.$queryRawUnsafe(
    `SELECT
       regexp_replace(lower(payment_id), '[^a-z0-9]', '', 'g') as payment_id_key,
       nominal_currency_uuid,
       SUM(ABS(nominal_amount))::numeric as paid
     FROM (
       ${RAW_BANK_UNION}
     ) tx
     WHERE payment_id IS NOT NULL AND payment_id <> ''
     GROUP BY regexp_replace(lower(payment_id), '[^a-z0-9]', '', 'g'), nominal_currency_uuid`
  );

  const paidMap = new Map();
  const paidByPayment = new Map();
  const currencySetMap = new Map();

  for (const row of paidRows) {
    const paymentKey = String(row.payment_id_key || '').trim();
    if (!paymentKey) continue;
    const currencyKey = row.nominal_currency_uuid ? String(row.nominal_currency_uuid) : '';
    const amount = row.paid ? Number(row.paid) : 0;

    paidMap.set(`${paymentKey}|${currencyKey}`, amount);
    paidByPayment.set(paymentKey, (paidByPayment.get(paymentKey) || 0) + amount);

    if (!currencySetMap.has(paymentKey)) currencySetMap.set(paymentKey, new Set());
    currencySetMap.get(paymentKey).add(currencyKey);
  }

  const salaryRowsDetailed = accruals.map((a) => {
    const paymentKey = normalizeKey(a.payment_id || '');
    const currencyKey = a.nominal_currency_uuid ? String(a.nominal_currency_uuid) : '';
    const paidByCurrencyKey = `${paymentKey}|${currencyKey}`;
    const hasCurrencyMatch = paidMap.has(paidByCurrencyKey);
    let paid = hasCurrencyMatch ? (paidMap.get(paidByCurrencyKey) || 0) : 0;
    if (!hasCurrencyMatch) {
      const currencySet = currencySetMap.get(paymentKey);
      if (currencySet && currencySet.size <= 1) {
        paid = paidByPayment.get(paymentKey) || 0;
      }
    }
    return {
      id: String(a.id),
      payment_id: a.payment_id,
      nominal_currency_uuid: a.nominal_currency_uuid,
      salary_month: a.salary_month,
      net_sum: Number(a.net_sum || 0),
      paid,
    };
  });

  const salaryPaymentIds = Array.from(new Set(accruals.map((a) => a.payment_id).filter(Boolean)));
  const salaryPaymentIdKeySet = new Set(salaryPaymentIds.map((p) => normalizePaymentKey(p)));

  const sourceTables = [
    { name: 'GE78BG0000000893486000_BOG_GEL', offset: 0 },
    { name: 'GE65TB7856036050100002_TBC_GEL', offset: 1000000000000 },
  ];

  const rawBankUnionQuery = sourceTables.map((table) => (
    `SELECT
       id,
       raw_record_uuid,
       payment_id,
       account_currency_amount,
       nominal_amount,
       counteragent_uuid,
       '${table.name}' as source_table,
       ${table.offset}::bigint as source_offset
     FROM "${table.name}"`
  )).join(' UNION ALL ');

  const bankTx = await prisma.$queryRawUnsafe(
    `SELECT
      result.payment_id,
      result.raw_payment_id,
      result.nominal_amount,
      result.account_currency_amount,
      result.source_table
     FROM (
       SELECT
         CASE WHEN cba.payment_id ILIKE 'BTC_%' THEN NULL ELSE cba.payment_id END as payment_id,
         cba.payment_id::text as raw_payment_id,
         cba.nominal_amount,
         cba.account_currency_amount,
         cba.source_table
       FROM (
         ${rawBankUnionQuery}
       ) cba
       WHERE NOT EXISTS (
         SELECT 1 FROM bank_transaction_batches btb
         WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
       )
         AND cba.counteragent_uuid = $1::uuid

       UNION ALL

       SELECT
         COALESCE(
           CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
           p.payment_id
         ) as payment_id,
         cba.payment_id::text as raw_payment_id,
         (btb.nominal_amount * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount,
         (btb.partition_amount * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as account_currency_amount,
         cba.source_table
       FROM (
         ${rawBankUnionQuery}
       ) cba
       JOIN bank_transaction_batches btb
         ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
       LEFT JOIN payments p
         ON (
           btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
         ) OR (
           btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
         )
       WHERE btb.counteragent_uuid = $1::uuid
     ) result`,
    counteragent.counteragent_uuid
  );

  const statementSalaryTx = bankTx.filter((tx) => {
    const pid = tx.payment_id;
    if (!pid) return false;
    return salaryPaymentIdKeySet.has(normalizePaymentKey(pid));
  });

  const salaryPagePaidTotal = salaryRowsDetailed.reduce((sum, row) => sum + row.paid, 0);
  const salaryPageUniquePaymentPaidTotal = Array.from(new Set(salaryRowsDetailed.map((r) => normalizeKey(r.payment_id)))).reduce((sum, key) => sum + (paidByPayment.get(key) || 0), 0);

  const statementNominalAbsTotal = statementSalaryTx.reduce((sum, tx) => sum + Math.abs(Number(tx.nominal_amount || 0)), 0);
  const statementNominalSignedTotal = statementSalaryTx.reduce((sum, tx) => sum + Number(tx.nominal_amount || 0), 0);

  const perPayment = new Map();

  for (const row of salaryRowsDetailed) {
    const key = normalizePaymentKey(row.payment_id);
    if (!perPayment.has(key)) {
      perPayment.set(key, { paymentId: row.payment_id, salaryPaid: 0, statementAbs: 0, statementSigned: 0, rows: 0, txCount: 0 });
    }
    const entry = perPayment.get(key);
    entry.salaryPaid += Number(row.paid || 0);
    entry.rows += 1;
  }

  for (const tx of statementSalaryTx) {
    const key = normalizePaymentKey(tx.payment_id);
    if (!perPayment.has(key)) {
      perPayment.set(key, { paymentId: tx.payment_id, salaryPaid: 0, statementAbs: 0, statementSigned: 0, rows: 0, txCount: 0 });
    }
    const entry = perPayment.get(key);
    const nominal = Number(tx.nominal_amount || 0);
    entry.statementAbs += Math.abs(nominal);
    entry.statementSigned += nominal;
    entry.txCount += 1;
  }

  const perPaymentDiff = Array.from(perPayment.values())
    .map((x) => ({
      ...x,
      diffAbsVsSalary: Number((x.statementAbs - x.salaryPaid).toFixed(2)),
    }))
    .filter((x) => Math.abs(x.diffAbsVsSalary) > 0.01)
    .sort((a, b) => Math.abs(b.diffAbsVsSalary) - Math.abs(a.diffAbsVsSalary));

  const output = {
    counteragent: {
      uuid: counteragent.counteragent_uuid,
      name: counteragent.counteragent,
      identification_number: counteragent.identification_number,
    },
    counts: {
      salaryAccrualRows: accruals.length,
      salaryPaymentIdsDistinct: salaryPaymentIds.length,
      bankTransactionsForCounteragent: bankTx.length,
      bankTransactionsMatchedToSalaryPaymentIds: statementSalaryTx.length,
    },
    totals: {
      salaryAccrualsPage_paidSumAcrossRows: Number(salaryPagePaidTotal.toFixed(2)),
      salaryAccrualsPage_paidSumDistinctPaymentIds: Number(salaryPageUniquePaymentPaidTotal.toFixed(2)),
      counteragentStatement_salaryPayments_nominalAbsSum: Number(statementNominalAbsTotal.toFixed(2)),
      counteragentStatement_salaryPayments_nominalSignedSum: Number(statementNominalSignedTotal.toFixed(2)),
      diff_abs_vs_salaryRows: Number((statementNominalAbsTotal - salaryPagePaidTotal).toFixed(2)),
      diff_abs_vs_salaryDistinct: Number((statementNominalAbsTotal - salaryPageUniquePaymentPaidTotal).toFixed(2)),
    },
    topPaymentDiffs: perPaymentDiff.slice(0, 30),
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
