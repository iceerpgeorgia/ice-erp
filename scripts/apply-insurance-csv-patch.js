const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CSV_PATH = path.resolve(process.cwd(), 'Insurance.csv');
const PATCH_USER = 'supabase_insurance_csv_patch';

function parseNumberOrNull(value) {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const normalized = raw.replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: "${value}"`);
  }
  return parsed;
}

function parsePeriodToken(period) {
  const token = String(period || '').trim().toUpperCase();
  const match = token.match(/^PRL(0[1-9]|1[0-2])(\d{4})$/);
  if (!match) {
    throw new Error(`Invalid period token: "${period}" (expected PRLMMYYYY)`);
  }
  return token;
}

function toSqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toFixed(2);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseCsvRows(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Insurance.csv is empty or missing data rows');
  }

  const header = lines[0].split(',').map((cell) => cell.trim().toLowerCase());
  const idxPeriod = header.findIndex((h) => h === 'period');
  const idxCounteragent = header.findIndex((h) => h === 'counteragent id');
  const idxDeductable = header.findIndex((h) => h === 'deductable');
  const idxSurplus = header.findIndex((h) => h === 'surplus');

  if ([idxPeriod, idxCounteragent, idxDeductable, idxSurplus].some((i) => i === -1)) {
    throw new Error('Insurance.csv must have headers: Period, Counteragent ID, Deductable, Surplus');
  }

  const dedup = new Map();

  for (let i = 1; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const cells = rawLine.split(',');
    const period = cells[idxPeriod]?.trim();
    const counteragentUuid = (cells[idxCounteragent] || '').trim().toLowerCase();
    const deductable = parseNumberOrNull(cells[idxDeductable]);
    const surplus = parseNumberOrNull(cells[idxSurplus]);

    if (!period && !counteragentUuid) {
      continue;
    }

    if (!counteragentUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
      throw new Error(`Invalid counteragent UUID at CSV line ${i + 1}: "${counteragentUuid}"`);
    }

    const periodToken = parsePeriodToken(period);
    const key = `${counteragentUuid}|${periodToken}`;

    dedup.set(key, {
      counteragent_uuid: counteragentUuid,
      period_token: periodToken,
      deducted_insurance: deductable,
      surplus_insurance: surplus,
    });
  }

  return Array.from(dedup.values());
}

async function insertPatchRows(tx, rows, chunkSize = 400) {
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const valuesSql = chunk
      .map((row) => `(${toSqlValue(row.counteragent_uuid)}::uuid, ${toSqlValue(row.period_token)}, ${toSqlValue(row.deducted_insurance)}, ${toSqlValue(row.surplus_insurance)})`)
      .join(',\n');

    await tx.$executeRawUnsafe(`
      INSERT INTO tmp_insurance_patch (counteragent_uuid, period_token, deducted_insurance, surplus_insurance)
      VALUES
      ${valuesSql}
    `);
  }
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`File not found: ${CSV_PATH}`);
  }

  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const patchRows = parseCsvRows(csv);

  if (patchRows.length === 0) {
    throw new Error('No valid patch rows found in Insurance.csv');
  }

  console.log(`Parsed rows: ${patchRows.length}`);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cleared = await tx.$executeRawUnsafe(`
      UPDATE public.salary_accruals
      SET
        deducted_insurance = NULL,
        surplus_insurance = NULL,
        updated_at = now(),
        updated_by = $1
    `, PATCH_USER);

      await tx.$executeRawUnsafe(`
        CREATE TEMP TABLE tmp_insurance_patch (
          counteragent_uuid uuid NOT NULL,
          period_token text NOT NULL,
          deducted_insurance numeric(15,2),
          surplus_insurance numeric(15,2)
        ) ON COMMIT DROP
      `);

      await insertPatchRows(tx, patchRows);

      const updated = await tx.$executeRawUnsafe(`
      UPDATE public.salary_accruals sa
      SET
        deducted_insurance = p.deducted_insurance,
        surplus_insurance = p.surplus_insurance,
        updated_at = now(),
        updated_by = $1
      FROM tmp_insurance_patch p
      WHERE sa.counteragent_uuid = p.counteragent_uuid
        AND UPPER(sa.payment_id) LIKE ('%' || p.period_token)
    `, PATCH_USER);

      const unmatched = await tx.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count
      FROM tmp_insurance_patch p
      LEFT JOIN public.salary_accruals sa
        ON sa.counteragent_uuid = p.counteragent_uuid
       AND UPPER(sa.payment_id) LIKE ('%' || p.period_token)
      WHERE sa.id IS NULL
    `);

      const sampleUnmatched = await tx.$queryRawUnsafe(`
      SELECT p.counteragent_uuid, p.period_token, p.deducted_insurance, p.surplus_insurance
      FROM tmp_insurance_patch p
      LEFT JOIN public.salary_accruals sa
        ON sa.counteragent_uuid = p.counteragent_uuid
       AND UPPER(sa.payment_id) LIKE ('%' || p.period_token)
      WHERE sa.id IS NULL
      ORDER BY p.counteragent_uuid, p.period_token
      LIMIT 20
    `);

      return { cleared, updated, unmatched, sampleUnmatched };
    });

    console.log('--- INSURANCE PATCH COMPLETE ---');
    console.log(`Cleared rows: ${result.cleared}`);
    console.log(`Patched rows: ${result.updated}`);
    console.log(`Unmatched patch rows: ${result.unmatched?.[0]?.count ?? 0}`);

    if ((result.unmatched?.[0]?.count ?? 0) > 0) {
      console.log('Sample unmatched rows (up to 20):');
      console.table(result.sampleUnmatched);
    }
  } catch (error) {
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('PATCH_FAILED', error?.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
