const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

const PAYMENT_KEY_SQL = "lower(regexp_replace(trim(payment_id), '[^a-zA-Z0-9]', '', 'g'))";

function hasFlag(name) {
  return process.argv.includes(name);
}

function getArg(name) {
  const idx = process.argv.findIndex((a) => a === name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function parseSalaryId(paymentId) {
  const raw = String(paymentId || '').trim();
  const match = raw.match(/^(NP_[A-Za-z0-9]{6}_NJ_[A-Za-z0-9]{6})_+PRL(\d{2})(\d{4})$/i);
  if (!match) return null;
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);
  if (!Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  return {
    raw,
    base: match[1].toUpperCase(),
    mm,
    yyyy,
    periodNum: yyyy * 12 + mm,
    period: `${match[2]}${match[3]}`,
  };
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function getMissingTransactionSalaryIds() {
  const out = [];
  for (const table of TABLES) {
    const rows = await prisma.$queryRawUnsafe(`
      WITH tx AS (
        SELECT
          payment_id,
          COUNT(*)::int as row_count,
          ${PAYMENT_KEY_SQL} as pid_key
        FROM "${table}"
        WHERE payment_id IS NOT NULL
          AND payment_id <> ''
          AND payment_id ~* '^NP_.*_PRL[0-9]{6}$'
        GROUP BY payment_id, ${PAYMENT_KEY_SQL}
      ),
      sa AS (
        SELECT DISTINCT ${PAYMENT_KEY_SQL} as pid_key
        FROM salary_accruals
        WHERE payment_id IS NOT NULL
          AND payment_id <> ''
      )
      SELECT tx.payment_id, tx.row_count, tx.pid_key
      FROM tx
      LEFT JOIN sa ON sa.pid_key = tx.pid_key
      WHERE sa.pid_key IS NULL
      ORDER BY tx.row_count DESC, tx.payment_id
    `);

    for (const row of rows) {
      out.push({
        table,
        paymentId: row.payment_id,
        rowCount: Number(row.row_count || 0),
        pidKey: row.pid_key,
      });
    }
  }
  return out;
}

async function getAccrualSalaryIdsByBase() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT payment_id
    FROM salary_accruals
    WHERE payment_id IS NOT NULL
      AND payment_id <> ''
      AND payment_id ~* '^NP_.*_PRL[0-9]{6}$'
  `);

  const byBase = new Map();
  for (const row of rows) {
    const parsed = parseSalaryId(row.payment_id);
    if (!parsed) continue;
    if (!byBase.has(parsed.base)) byBase.set(parsed.base, []);
    byBase.get(parsed.base).push(parsed);
  }

  for (const [base, arr] of byBase.entries()) {
    arr.sort((a, b) => a.periodNum - b.periodNum);
    byBase.set(base, arr);
  }

  return byBase;
}

function chooseClosestByPeriod(source, candidates, maxDistanceMonths) {
  if (!candidates.length) return { target: null, reason: 'no-candidate' };

  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let tie = false;

  for (const c of candidates) {
    const distance = Math.abs(c.periodNum - source.periodNum);
    if (distance < bestDistance) {
      best = c;
      bestDistance = distance;
      tie = false;
    } else if (distance === bestDistance) {
      tie = true;
    }
  }

  if (!best) return { target: null, reason: 'no-candidate' };
  if (tie) return { target: null, reason: 'ambiguous-tie' };
  if (bestDistance > maxDistanceMonths) {
    return { target: null, reason: 'distance-too-large' };
  }
  return { target: best, reason: 'closest-period' };
}

async function applyMapping(mapping) {
  const sourceKey = normalizeKey(mapping.fromPaymentId);

  const updated = await prisma.$executeRawUnsafe(
    `
      UPDATE "${mapping.table}"
      SET payment_id = $1,
          updated_at = NOW()
      WHERE ${PAYMENT_KEY_SQL} = $2
    `,
    mapping.toPaymentId,
    sourceKey
  );

  const updatedBatches = await prisma.$executeRawUnsafe(
    `
      UPDATE bank_transaction_batches
      SET payment_id = $1,
          updated_at = NOW()
      WHERE payment_id IS NOT NULL
        AND ${PAYMENT_KEY_SQL} = $2
    `,
    mapping.toPaymentId,
    sourceKey
  );

  return {
    updatedRows: Number(updated || 0),
    updatedBatchRows: Number(updatedBatches || 0),
  };
}

async function main() {
  const apply = hasFlag('--apply');
  const maxDistanceMonths = Number(getArg('--max-distance') || 2);

  const missing = await getMissingTransactionSalaryIds();
  const accrualByBase = await getAccrualSalaryIdsByBase();

  const mappings = [];
  const unresolved = [];

  for (const row of missing) {
    const parsed = parseSalaryId(row.paymentId);
    if (!parsed) {
      unresolved.push({ ...row, reason: 'invalid-format' });
      continue;
    }

    const candidates = accrualByBase.get(parsed.base) || [];
    const choice = chooseClosestByPeriod(parsed, candidates, maxDistanceMonths);
    if (!choice.target) {
      unresolved.push({ ...row, reason: choice.reason, candidateCount: candidates.length });
      continue;
    }

    mappings.push({
      table: row.table,
      fromPaymentId: row.paymentId,
      toPaymentId: choice.target.raw,
      rowCount: row.rowCount,
      sourcePeriod: parsed.period,
      targetPeriod: choice.target.period,
      distanceMonths: Math.abs(choice.target.periodNum - parsed.periodNum),
    });
  }

  const summary = {
    mode: apply ? 'APPLY' : 'DRY-RUN',
    maxDistanceMonths,
    missingDistinctIds: missing.length,
    proposedMappings: mappings.length,
    unresolved: unresolved.length,
    unresolvedByReason: unresolved.reduce((acc, row) => {
      acc[row.reason] = (acc[row.reason] || 0) + 1;
      return acc;
    }, {}),
    sampleMappings: mappings.slice(0, 20),
    sampleUnresolved: unresolved.slice(0, 20),
    applied: {
      tableRowsUpdated: 0,
      batchRowsUpdated: 0,
    },
  };

  if (apply) {
    for (const mapping of mappings) {
      const r = await applyMapping(mapping);
      summary.applied.tableRowsUpdated += r.updatedRows;
      summary.applied.batchRowsUpdated += r.updatedBatchRows;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
