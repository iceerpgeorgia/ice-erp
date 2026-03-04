const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

const SALARY_ID_REGEX = /^NP_.*_PRL\d{6}$/i;

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseSalaryId(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(NP_[A-Za-z0-9]{6}_NJ_[A-Za-z0-9]{6})_+PRL(\d{2})(\d{4})$/i);
  if (!match) {
    return null;
  }
  return {
    raw,
    base: match[1].toUpperCase(),
    mm: Number(match[2]),
    yyyy: Number(match[3]),
    period: `${match[2]}${match[3]}`,
  };
}

function toMonthLabel(period) {
  if (!period || period.length !== 6) return 'unknown';
  return `${period.slice(2)}-${period.slice(0, 2)}`;
}

function buildSqlPreview(remapCandidates) {
  const now = new Date().toISOString();
  const lines = [];
  lines.push('-- Salary payment binding repair preview (NOT EXECUTED)');
  lines.push(`-- Generated at: ${now}`);
  lines.push(`-- Safe remap candidates: ${remapCandidates.length}`);
  lines.push('-- Review and run manually only after verification.');
  lines.push('BEGIN;');
  lines.push('');

  if (remapCandidates.length === 0) {
    lines.push('-- No safe remap candidates found.');
    lines.push('ROLLBACK;');
    return lines.join('\n');
  }

  for (const c of remapCandidates) {
    const oldKey = normalizeKey(c.fromPaymentId);
    lines.push(`-- ${c.table}: ${c.fromPaymentId} -> ${c.toPaymentId} (rows=${c.rowCount})`);
    lines.push(
      `UPDATE "${c.table}"\n` +
        `SET payment_id = '${c.toPaymentId.replace(/'/g, "''")}', updated_at = NOW()\n` +
        `WHERE lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) = '${oldKey}';`
    );
    lines.push('');
  }

  lines.push('-- Also keep batch partition ids aligned, if present:');
  for (const c of remapCandidates) {
    const oldKey = normalizeKey(c.fromPaymentId);
    lines.push(
      `UPDATE bank_transaction_batches\n` +
        `SET payment_id = '${c.toPaymentId.replace(/'/g, "''")}', updated_at = NOW()\n` +
        `WHERE payment_id IS NOT NULL\n` +
        `  AND lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) = '${oldKey}';`
    );
    lines.push('');
  }

  lines.push('-- Replace ROLLBACK with COMMIT only after validating updated row counts.');
  lines.push('ROLLBACK;');
  return lines.join('\n');
}

async function run() {
  const result = {
    generatedAt: new Date().toISOString(),
    missingInSalaryAccruals: {
      byTable: {},
      byMonth: {},
      totalDistinctIds: 0,
      totalRows: 0,
      sample: [],
    },
    salaryAccrualsWithoutTransactions: {
      totalDistinctIds: 0,
      byMonth: {},
      sample: [],
    },
    remapPreview: {
      safeCandidates: 0,
      ambiguousCandidates: 0,
      samples: [],
      sqlFile: 'scripts-output/salary-payment-remap-preview.sql',
    },
  };

  const txMissingRows = [];

  for (const table of TABLES) {
    const rows = await prisma.$queryRawUnsafe(`
      WITH tx AS (
        SELECT
          payment_id,
          COUNT(*)::int as row_count,
          lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
        FROM "${table}"
        WHERE payment_id IS NOT NULL
          AND payment_id <> ''
          AND payment_id ~* '^NP_.*_PRL[0-9]{6}$'
        GROUP BY payment_id, lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g'))
      ),
      sa AS (
        SELECT DISTINCT lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
        FROM salary_accruals
        WHERE payment_id IS NOT NULL
          AND payment_id <> ''
      )
      SELECT tx.payment_id, tx.pid_key, tx.row_count
      FROM tx
      LEFT JOIN sa ON sa.pid_key = tx.pid_key
      WHERE sa.pid_key IS NULL
      ORDER BY tx.row_count DESC, tx.payment_id
    `);

    result.missingInSalaryAccruals.byTable[table] = {
      distinctIds: rows.length,
      totalRows: rows.reduce((sum, r) => sum + Number(r.row_count || 0), 0),
      sample: rows.slice(0, 10).map((r) => r.payment_id),
    };

    for (const row of rows) {
      txMissingRows.push({
        table,
        paymentId: row.payment_id,
        rowCount: Number(row.row_count || 0),
        pidKey: row.pid_key,
      });
    }
  }

  const monthMapMissing = new Map();
  for (const row of txMissingRows) {
    const parsed = parseSalaryId(row.paymentId);
    const month = parsed ? toMonthLabel(parsed.period) : 'unknown';
    const existing = monthMapMissing.get(month) || { distinctIds: 0, totalRows: 0 };
    existing.distinctIds += 1;
    existing.totalRows += row.rowCount;
    monthMapMissing.set(month, existing);
  }

  result.missingInSalaryAccruals.totalDistinctIds = txMissingRows.length;
  result.missingInSalaryAccruals.totalRows = txMissingRows.reduce((sum, r) => sum + r.rowCount, 0);
  result.missingInSalaryAccruals.sample = txMissingRows.slice(0, 20).map((r) => ({
    table: r.table,
    paymentId: r.paymentId,
    rowCount: r.rowCount,
  }));
  result.missingInSalaryAccruals.byMonth = Object.fromEntries(
    [...monthMapMissing.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  );

  const accrualOrphans = await prisma.$queryRawUnsafe(`
    WITH sa AS (
      SELECT DISTINCT payment_id, lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
      FROM salary_accruals
      WHERE payment_id IS NOT NULL
        AND payment_id <> ''
        AND payment_id ~* '^NP_.*_PRL[0-9]{6}$'
    ),
    tx AS (
      SELECT DISTINCT lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
      FROM "GE78BG0000000893486000_BOG_GEL"
      WHERE payment_id IS NOT NULL
        AND payment_id <> ''
        AND payment_id ~* '^NP_.*_PRL[0-9]{6}$'
      UNION
      SELECT DISTINCT lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g')) as pid_key
      FROM "GE65TB7856036050100002_TBC_GEL"
      WHERE payment_id IS NOT NULL
        AND payment_id <> ''
        AND payment_id ~* '^NP_.*_PRL[0-9]{6}$'
    )
    SELECT sa.payment_id
    FROM sa
    LEFT JOIN tx ON tx.pid_key = sa.pid_key
    WHERE tx.pid_key IS NULL
    ORDER BY sa.payment_id
  `);

  const orphanMonthMap = new Map();
  for (const row of accrualOrphans) {
    const parsed = parseSalaryId(row.payment_id);
    const month = parsed ? toMonthLabel(parsed.period) : 'unknown';
    orphanMonthMap.set(month, (orphanMonthMap.get(month) || 0) + 1);
  }

  result.salaryAccrualsWithoutTransactions.totalDistinctIds = accrualOrphans.length;
  result.salaryAccrualsWithoutTransactions.byMonth = Object.fromEntries(
    [...orphanMonthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  );
  result.salaryAccrualsWithoutTransactions.sample = accrualOrphans.slice(0, 20).map((r) => r.payment_id);

  const accrualRows = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT payment_id
    FROM salary_accruals
    WHERE payment_id IS NOT NULL
      AND payment_id <> ''
      AND payment_id ~* '^NP_.*_PRL[0-9]{6}$'
  `);

  const accrualByBase = new Map();
  for (const row of accrualRows) {
    const parsed = parseSalaryId(row.payment_id);
    if (!parsed) continue;
    if (!accrualByBase.has(parsed.base)) {
      accrualByBase.set(parsed.base, []);
    }
    accrualByBase.get(parsed.base).push(parsed);
  }

  for (const [base, arr] of accrualByBase.entries()) {
    arr.sort((a, b) => {
      const aa = a.yyyy * 100 + a.mm;
      const bb = b.yyyy * 100 + b.mm;
      return bb - aa;
    });
    accrualByBase.set(base, arr);
  }

  const remapCandidates = [];
  let ambiguousCandidates = 0;

  for (const row of txMissingRows) {
    const parsed = parseSalaryId(row.paymentId);
    if (!parsed) continue;
    const candidates = accrualByBase.get(parsed.base) || [];
    if (candidates.length === 1) {
      remapCandidates.push({
        table: row.table,
        fromPaymentId: row.paymentId,
        toPaymentId: candidates[0].raw,
        rowCount: row.rowCount,
      });
    } else if (candidates.length > 1) {
      ambiguousCandidates += 1;
    }
  }

  result.remapPreview.safeCandidates = remapCandidates.length;
  result.remapPreview.ambiguousCandidates = ambiguousCandidates;
  result.remapPreview.samples = remapCandidates.slice(0, 20);

  const sqlPreview = buildSqlPreview(remapCandidates);
  const outDir = path.join(process.cwd(), 'scripts-output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const sqlPath = path.join(outDir, 'salary-payment-remap-preview.sql');
  fs.writeFileSync(sqlPath, sqlPreview, 'utf8');

  console.log(JSON.stringify(result, null, 2));
  console.log(`\nSQL preview written: ${sqlPath}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
