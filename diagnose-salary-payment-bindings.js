const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

const SALARY_ID_REGEX = '^NP_.*_PRL[0-9]{6}$';
const PAYMENT_KEY_EXPR = "lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g'))";

async function run() {
  const out = {
    generatedAt: new Date().toISOString(),
    tables: {},
    totals: {},
  };

  let totalTxRows = 0;
  let totalDistinctTxIds = 0;
  let totalMissingInAccruals = 0;

  for (const table of TABLES) {
    const tableStats = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int as tx_rows,
        COUNT(DISTINCT ${PAYMENT_KEY_EXPR})::int as distinct_salary_payment_ids
      FROM "${table}"
      WHERE payment_id IS NOT NULL
        AND payment_id <> ''
        AND payment_id ~* $1
    `, SALARY_ID_REGEX);

    const missingInAccruals = await prisma.$queryRawUnsafe(`
      WITH tx AS (
        SELECT DISTINCT ${PAYMENT_KEY_EXPR} as pid_key
        FROM "${table}"
        WHERE payment_id IS NOT NULL
          AND payment_id <> ''
          AND payment_id ~* $1
      ),
      sa AS (
        SELECT DISTINCT lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
        FROM salary_accruals
        WHERE payment_id IS NOT NULL
          AND payment_id <> ''
      )
      SELECT COUNT(*)::int as missing_in_salary_accruals
      FROM tx
      LEFT JOIN sa ON sa.pid_key = tx.pid_key
      WHERE sa.pid_key IS NULL
    `, SALARY_ID_REGEX);

    const sampleMissing = await prisma.$queryRawUnsafe(`
      WITH tx AS (
        SELECT DISTINCT payment_id, ${PAYMENT_KEY_EXPR} as pid_key
        FROM "${table}"
        WHERE payment_id IS NOT NULL
          AND payment_id <> ''
          AND payment_id ~* $1
      ),
      sa AS (
        SELECT DISTINCT lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
        FROM salary_accruals
        WHERE payment_id IS NOT NULL
          AND payment_id <> ''
      )
      SELECT tx.payment_id
      FROM tx
      LEFT JOIN sa ON sa.pid_key = tx.pid_key
      WHERE sa.pid_key IS NULL
      ORDER BY tx.payment_id
      LIMIT 10
    `, SALARY_ID_REGEX);

    const txRows = Number(tableStats[0]?.tx_rows || 0);
    const distinctSalaryPaymentIds = Number(tableStats[0]?.distinct_salary_payment_ids || 0);
    const missingCount = Number(missingInAccruals[0]?.missing_in_salary_accruals || 0);

    out.tables[table] = {
      txRows,
      distinctSalaryPaymentIds,
      missingInSalaryAccruals: missingCount,
      sampleMissingInSalaryAccruals: sampleMissing.map((row) => row.payment_id),
    };

    totalTxRows += txRows;
    totalDistinctTxIds += distinctSalaryPaymentIds;
    totalMissingInAccruals += missingCount;
  }

  const salaryWithoutTx = await prisma.$queryRawUnsafe(`
    WITH sa AS (
      SELECT DISTINCT payment_id, lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
      FROM salary_accruals
      WHERE payment_id IS NOT NULL
        AND payment_id <> ''
        AND payment_id ~* $1
    ),
    tx AS (
      SELECT DISTINCT lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
      FROM "GE78BG0000000893486000_BOG_GEL"
      WHERE payment_id IS NOT NULL
        AND payment_id <> ''
        AND payment_id ~* $1
      UNION
      SELECT DISTINCT lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
      FROM "GE65TB7856036050100002_TBC_GEL"
      WHERE payment_id IS NOT NULL
        AND payment_id <> ''
        AND payment_id ~* $1
    )
    SELECT COUNT(*)::int as salary_ids_without_transactions
    FROM sa
    LEFT JOIN tx ON tx.pid_key = sa.pid_key
    WHERE tx.pid_key IS NULL
  `, SALARY_ID_REGEX);

  const sampleSalaryWithoutTx = await prisma.$queryRawUnsafe(`
    WITH sa AS (
      SELECT DISTINCT payment_id, lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
      FROM salary_accruals
      WHERE payment_id IS NOT NULL
        AND payment_id <> ''
        AND payment_id ~* $1
    ),
    tx AS (
      SELECT DISTINCT lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
      FROM "GE78BG0000000893486000_BOG_GEL"
      WHERE payment_id IS NOT NULL
        AND payment_id <> ''
        AND payment_id ~* $1
      UNION
      SELECT DISTINCT lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
      FROM "GE65TB7856036050100002_TBC_GEL"
      WHERE payment_id IS NOT NULL
        AND payment_id <> ''
        AND payment_id ~* $1
    )
    SELECT sa.payment_id
    FROM sa
    LEFT JOIN tx ON tx.pid_key = sa.pid_key
    WHERE tx.pid_key IS NULL
    ORDER BY sa.payment_id
    LIMIT 15
  `, SALARY_ID_REGEX);

  out.totals = {
    salaryLinkedTransactionRows: totalTxRows,
    distinctSalaryPaymentIdsInTransactions: totalDistinctTxIds,
    distinctSalaryPaymentIdsMissingInAccruals: totalMissingInAccruals,
    salaryAccrualPaymentIdsWithoutTransactions: Number(salaryWithoutTx[0]?.salary_ids_without_transactions || 0),
    sampleSalaryAccrualIdsWithoutTransactions: sampleSalaryWithoutTx.map((row) => row.payment_id),
  };

  console.log(JSON.stringify(out, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
