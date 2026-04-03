import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getInsiderOptions, resolveInsiderSelection, sqlUuidInList } from '@/lib/insider-selection';
import { getSourceTables } from '@/lib/source-tables';

export const revalidate = 0;

const normalizePaymentKey = (value: string) => {
  const trimmed = value.trim();
  const base = trimmed.includes(':') ? trimmed.split(':')[0] : trimmed;
  return base.toLowerCase();
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeInsuranceValues = (
  surplusInsurance: number | null,
  deductedInsurance: number | null,
) => {
  return {
    surplusInsurance,
    deductedInsurance,
  };
};

const serializeInsuranceValues = (accrual: {
  surplus_insurance: unknown;
  deducted_insurance: unknown;
}) => {
  const normalized = normalizeInsuranceValues(
    parseNullableNumber(accrual.surplus_insurance),
    parseNullableNumber(accrual.deducted_insurance),
  );
  return {
    surplus_insurance:
      normalized.surplusInsurance === null || normalized.surplusInsurance === undefined
        ? null
        : normalized.surplusInsurance.toString(),
    deducted_insurance:
      normalized.deductedInsurance === null || normalized.deductedInsurance === undefined
        ? null
        : normalized.deductedInsurance.toString(),
  };
};

async function remapPaymentIdBindings(oldPaymentId: string, newPaymentId: string, sourceTables: string[]) {
  if (!oldPaymentId || !newPaymentId) return;
  if (oldPaymentId.trim().toLowerCase() === newPaymentId.trim().toLowerCase()) return;

  for (const tableName of sourceTables) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "${tableName}"
        SET payment_id = $1,
            updated_at = NOW()
        WHERE lower(trim(payment_id)) = lower(trim($2))
      `,
      newPaymentId,
      oldPaymentId
    );
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE bank_transaction_batches
      SET payment_id = $1,
          updated_at = NOW()
      WHERE payment_id IS NOT NULL
        AND lower(trim(payment_id)) = lower(trim($2))
    `,
    newPaymentId,
    oldPaymentId
  );
}

// Helper function to generate payment_id
function generatePaymentId(counteragentUuid: string, financial_code_uuid: string, salaryMonth: Date): string {
  // Extract characters at positions 2, 4, 6, 8, 10, 12 (1-indexed Excel MID)
  // This corresponds to indices 1, 3, 5, 7, 9, 11 (0-indexed) from UUID WITH hyphens
  const extractChars = (uuid: string) => {
    // Excel MID works on UUID WITH hyphens, so we DON'T remove them
    return uuid[1] + uuid[3] + uuid[5] + uuid[7] + uuid[9] + uuid[11];
  };
  
  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financial_code_uuid);
  
  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  
  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
}

// Extract YYYY-MM period from a salary payment_id (format: ...PRL{MM}{YYYY})
const extractPeriodFromPaymentId = (paymentId: string): string | null => {
  const match = paymentId.match(/prl(\d{2})(\d{4})$/i);
  if (!match) return null;
  return `${match[2]}-${match[1]}`;
};

// Build a last-day-of-month date string for a YYYY-MM period
const periodToDate = (period: string): string => {
  const [year, month] = period.split('-').map(Number);
  return `${year}-${String(month).padStart(2, '0')}-01`;
};

export async function GET(request: NextRequest) {
  try {
    const sourceTables = await getSourceTables();
    const selection = await resolveInsiderSelection(request);
    const insiderUuidListSql = sqlUuidInList(selection.selectedUuids);
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (id) {
      // Fetch single record
      const accrual = await prisma.salary_accruals.findUnique({
        where: { id: BigInt(id) },
      });

      if (!accrual) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      if (!selection.selectedUuids.includes(String(accrual.insider_uuid || ''))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      // Fetch related data
      const [counteragent, financial_code, currency] = await Promise.all([
        prisma.$queryRaw<any[]>`
          SELECT counteragent_uuid, counteragent FROM counteragents WHERE counteragent_uuid = ${accrual.counteragent_uuid}::uuid LIMIT 1
        `,
        prisma.$queryRaw<any[]>`
          SELECT uuid, validation FROM financial_codes WHERE uuid = ${accrual.financial_code_uuid}::uuid LIMIT 1
        `,
        prisma.$queryRaw<any[]>`
          SELECT uuid, code FROM currencies WHERE uuid = ${accrual.nominal_currency_uuid}::uuid LIMIT 1
        `,
      ]);

      return NextResponse.json({
        ...accrual,
        id: accrual.id.toString(),
        counteragent_name: counteragent[0]?.counteragent || 'Unknown',
        counteragent_iban: counteragent[0]?.iban || null,
        financial_code: financial_code[0]?.validation || 'Unknown',
        currency_code: currency[0]?.code || 'Unknown',
        net_sum: accrual.net_sum.toString(),
        ...serializeInsuranceValues({
          surplus_insurance: accrual.surplus_insurance,
          deducted_insurance: accrual.deducted_insurance,
        }),
        deducted_fitness: accrual.deducted_fitness?.toString() || null,
        deducted_fine: accrual.deducted_fine?.toString() || null,
      });
    }

    // Fetch all records with related data (no LATERAL JOIN for performance)
    const accruals = await prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          sa.id,
          sa.uuid,
          sa.counteragent_uuid,
          sa.insider_uuid,
          sa.financial_code_uuid,
          sa.nominal_currency_uuid,
          sa.payment_id,
          sa.salary_month,
          sa.net_sum,
          sa.surplus_insurance,
          sa.deducted_insurance,
          sa.deducted_fitness,
          sa.deducted_fine,
          sa.confirmed,
          sa.created_at,
          sa.updated_at,
          c.counteragent as counteragent_name,
          c.identification_number,
          c.sex,
          c.pension_scheme,
          c.department,
          c.iban as counteragent_iban,
          fc.validation as financial_code,
          cur.code as currency_code
        FROM salary_accruals sa
        LEFT JOIN counteragents c ON sa.counteragent_uuid = c.counteragent_uuid
        LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
        LEFT JOIN currencies cur ON sa.nominal_currency_uuid = cur.uuid
        WHERE sa.insider_uuid IN (${insiderUuidListSql})
        ORDER BY sa.salary_month DESC, sa.created_at DESC
      `);

    // Fetch unbound counteragent transactions (no payment_id, not in batch)
    const unboundRows = await prisma.$queryRaw<any[]>`
      SELECT counteragent_uuid, COUNT(*) as unbound_count
      FROM (
        ${Prisma.raw(sourceTables.map((tableName) => `
        SELECT ru.counteragent_uuid
        FROM "${tableName}" ru
        WHERE ru.counteragent_uuid IS NOT NULL
          AND (ru.payment_id IS NULL OR ru.payment_id = '')
          AND NOT EXISTS (
            SELECT 1 FROM bank_transaction_batches btb
            WHERE btb.raw_record_uuid::text = ru.raw_record_uuid::text
          )`).join(' UNION ALL '))}
      ) unbound
      GROUP BY counteragent_uuid
    `;

    const unboundSet = new Set<string>();
    for (const row of unboundRows) {
      if (row.counteragent_uuid && Number(row.unbound_count) > 0) {
        unboundSet.add(String(row.counteragent_uuid));
      }
    }

    const paidRows = await prisma.$queryRaw<any[]>`
      SELECT
        lower(trim(split_part(payment_id, ':', 1))) as payment_id_key,
        counteragent_uuid,
        nominal_currency_uuid,
        ABS(SUM(nominal_amount))::numeric as paid
      FROM (
        ${Prisma.raw(sourceTables.map((tableName) => `
        SELECT
          cba.payment_id,
          cba.counteragent_uuid,
          cba.nominal_currency_uuid,
          cba.nominal_amount
        FROM "${tableName}" cba
        WHERE NOT EXISTS (
          SELECT 1 FROM bank_transaction_batches btb
          WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
        )
        AND cba.payment_id NOT ILIKE 'BTC_%'`).join(' UNION ALL '))}
        UNION ALL
        ${Prisma.raw(sourceTables.map((tableName) => `
        SELECT
          COALESCE(
            CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
            p.payment_id
          ) as payment_id,
          COALESCE(btb.counteragent_uuid, p.counteragent_uuid, cba.counteragent_uuid) as counteragent_uuid,
          COALESCE(btb.nominal_currency_uuid, p.currency_uuid, cba.nominal_currency_uuid) as nominal_currency_uuid,
          (COALESCE(NULLIF(btb.nominal_amount, 0), btb.partition_amount) * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount
        FROM "${tableName}" cba
        JOIN bank_transaction_batches btb
          ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
        LEFT JOIN payments p
          ON (
            btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
          ) OR (
            btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
          )`).join(' UNION ALL '))}
      ) tx
      WHERE payment_id IS NOT NULL AND payment_id <> ''
      GROUP BY lower(trim(split_part(payment_id, ':', 1))), counteragent_uuid, nominal_currency_uuid
    `;

    const paidMap = new Map<string, number>();
    const paidByPayment = new Map<string, number>();
    const currencySetMap = new Map<string, Set<string>>();
    const paidByPaymentOnly = new Map<string, number>(); // fallback: keyed by payment_id only
    for (const row of paidRows) {
      const paymentKey = String(row.payment_id_key || '').trim();
      if (!paymentKey) continue;
      const counteragentKey = row.counteragent_uuid ? String(row.counteragent_uuid) : '';
      const currencyKey = row.nominal_currency_uuid ? String(row.nominal_currency_uuid) : '';
      const amount = row.paid ? Number(row.paid) : 0;
      const compositeKey = `${paymentKey}|${counteragentKey}`;
      paidMap.set(`${compositeKey}|${currencyKey}`, amount);
      paidByPayment.set(compositeKey, (paidByPayment.get(compositeKey) || 0) + amount);
      paidByPaymentOnly.set(paymentKey, (paidByPaymentOnly.get(paymentKey) || 0) + amount);
      if (!currencySetMap.has(compositeKey)) {
        currencySetMap.set(compositeKey, new Set());
      }
      currencySetMap.get(compositeKey)!.add(currencyKey);
    }

    // ===================== PROJECTED ACCRUALS =====================
    // Detect periods with bank payments but no accrual records
    // Build map of existing accrual periods per counteragent
    const existingPeriodsByCA = new Map<string, Set<string>>();
    for (const accrual of accruals) {
      const caUuid = String(accrual.counteragent_uuid || '');
      if (!caUuid) continue;
      if (!existingPeriodsByCA.has(caUuid)) existingPeriodsByCA.set(caUuid, new Set());
      if (accrual.salary_month) {
        const d = new Date(accrual.salary_month);
        if (!isNaN(d.getTime())) {
          existingPeriodsByCA.get(caUuid)!.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      }
    }

    // Find paid periods per counteragent from paidRows (PRL pattern)
    const paidPeriodsByCA = new Map<string, Set<string>>();
    for (const row of paidRows) {
      const pid = String(row.payment_id_key || '');
      const caUuid = String(row.counteragent_uuid || '');
      if (!caUuid || !pid) continue;
      const period = extractPeriodFromPaymentId(pid);
      if (period) {
        if (!paidPeriodsByCA.has(caUuid)) paidPeriodsByCA.set(caUuid, new Set());
        paidPeriodsByCA.get(caUuid)!.add(period);
      }
    }

    // Find the latest accrual per counteragent (accruals sorted DESC → first match is latest)
    const lastAccrualByCA = new Map<string, any>();
    for (const accrual of accruals) {
      const caUuid = String(accrual.counteragent_uuid || '');
      if (caUuid && !lastAccrualByCA.has(caUuid)) {
        lastAccrualByCA.set(caUuid, accrual);
      }
    }

    // Generate projected accruals for missing periods
    for (const [caUuid, paidPeriods] of paidPeriodsByCA) {
      const existingPeriods = existingPeriodsByCA.get(caUuid) || new Set();
      const lastAccrual = lastAccrualByCA.get(caUuid);
      if (!lastAccrual) continue;

      for (const period of Array.from(paidPeriods).sort()) {
        if (existingPeriods.has(period)) continue;

        const projectedDate = periodToDate(period);
        const [yearStr, monthStr] = period.split('-');
        const projectedPaymentId = generatePaymentId(
          String(lastAccrual.counteragent_uuid),
          String(lastAccrual.financial_code_uuid),
          new Date(Number(yearStr), Number(monthStr) - 1, 1)
        );

        accruals.push({
          ...lastAccrual,
          id: `projected-${caUuid}-${period}`,
          uuid: `projected-${caUuid}-${period}`,
          salary_month: projectedDate,
          payment_id: projectedPaymentId,
          confirmed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _projected: true,
        });
      }
    }

    // Re-sort (DESC by salary_month, same as original query)
    accruals.sort((a: any, b: any) => {
      const da = a.salary_month ? new Date(a.salary_month).getTime() : 0;
      const db = b.salary_month ? new Date(b.salary_month).getTime() : 0;
      return db - da;
    });

    const formattedAccruals = accruals.map((accrual) => {
      const paymentKey = normalizePaymentKey(String(accrual.payment_id || ''));
      const counteragentKey = accrual.counteragent_uuid ? String(accrual.counteragent_uuid) : '';
      const compositeKey = `${paymentKey}|${counteragentKey}`;
      const currencyKey = accrual.nominal_currency_uuid ? String(accrual.nominal_currency_uuid) : '';
      const paidByCurrencyKey = `${compositeKey}|${currencyKey}`;
      const hasCurrencyMatch = paidMap.has(paidByCurrencyKey);
      let paid = hasCurrencyMatch ? paidMap.get(paidByCurrencyKey) || 0 : 0;
      if (!hasCurrencyMatch) {
        const currencySet = currencySetMap.get(compositeKey);
        if (currencySet && currencySet.size <= 1) {
          paid = paidByPayment.get(compositeKey) || 0;
        }
      }
      // Fallback: match by payment_id alone — covers wage garnishments where the
      // same salary payment_id is split across employee + enforcement bureau counteragents.
      // Use the larger of: composite match vs payment_id-only total (which sums all counteragents).
      if (paymentKey) {
        const totalByPaymentId = paidByPaymentOnly.get(paymentKey) || 0;
        if (totalByPaymentId > paid) paid = totalByPaymentId;
      }
      return {
        paid,
        confirmed: Boolean(accrual.confirmed),
        hasUnboundCounteragentTransactions: unboundSet.has(String(accrual.counteragent_uuid)),
        projected: Boolean((accrual as any)._projected),
        ...accrual,
        id: accrual.id.toString(),
        net_sum: accrual.net_sum.toString(),
        insider_uuid: accrual.insider_uuid ?? null,
        ...serializeInsuranceValues({
          surplus_insurance: accrual.surplus_insurance,
          deducted_insurance: accrual.deducted_insurance,
        }),
        deducted_fitness: accrual.deducted_fitness?.toString() || null,
        deducted_fine: accrual.deducted_fine?.toString() || null,
      };
    });

    return NextResponse.json(formattedAccruals);
  } catch (error: any) {
    console.error('Error fetching salary accruals:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(request);
    const body = await request.json();
    if (body?.action === 'copy-latest') {
      const { base_month, target_month, created_by } = body;
      console.log('[copy-latest] Received:', { base_month, target_month, created_by });
      if (!base_month || !target_month) {
        return NextResponse.json({ error: 'Missing base_month or target_month' }, { status: 400 });
      }

      const baseStart = new Date(base_month);
      const targetDate = new Date(target_month);
      console.log('[copy-latest] Parsed dates:', { baseStart: baseStart.toISOString(), targetDate: targetDate.toISOString() });
      if (Number.isNaN(baseStart.getTime()) || Number.isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: 'Invalid base_month or target_month' }, { status: 400 });
      }

      const baseEnd = new Date(baseStart.getFullYear(), baseStart.getMonth() + 1, 1);
      console.log('[copy-latest] Query range:', { gte: baseStart.toISOString(), lt: baseEnd.toISOString() });

      // Also check insider selection
      const insiderUuids = selection.selectedUuids;
      console.log('[copy-latest] Insider selection:', insiderUuids.length, 'uuids');

      // Check if records already exist in the target month
      const targetEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
      const existingTargetCount = await prisma.salary_accruals.count({
        where: { salary_month: { gte: targetDate, lt: targetEnd } },
      });
      if (existingTargetCount > 0) {
        return NextResponse.json(
          { error: `Target month already has ${existingTargetCount} records. Delete them first before copying.` },
          { status: 409 }
        );
      }

      const baseRecords = await prisma.salary_accruals.findMany({
        where: { salary_month: { gte: baseStart, lt: baseEnd } },
      });
      console.log('[copy-latest] Found', baseRecords.length, 'base records');

      if (baseRecords.length === 0) {
        // Debug: check what months actually exist
        const allMonths = await prisma.$queryRawUnsafe<any[]>(
          `SELECT DISTINCT salary_month FROM salary_accruals ORDER BY salary_month DESC LIMIT 5`
        );
        console.log('[copy-latest] Latest 5 distinct months in DB:', allMonths.map((r: any) => r.salary_month));
        return NextResponse.json({ inserted: 0, base_count: 0, records: [] });
      }

      const createdIds: bigint[] = [];
      for (const record of baseRecords) {
        const created = await prisma.salary_accruals.create({
          data: {
            counteragent_uuid: record.counteragent_uuid,
            insider_uuid: record.insider_uuid,
            financial_code_uuid: record.financial_code_uuid,
            nominal_currency_uuid: record.nominal_currency_uuid,
            payment_id: generatePaymentId(record.counteragent_uuid, record.financial_code_uuid, targetDate),
            salary_month: targetDate,
            net_sum: record.net_sum,
            surplus_insurance: record.surplus_insurance,
            deducted_insurance: null,
            deducted_fitness: record.deducted_fitness,
            deducted_fine: record.deducted_fine,
            created_by: created_by || 'user',
            updated_by: created_by || 'user',
          },
        });
        createdIds.push(created.id);
      }

      const createdRecords = createdIds.length
        ? await prisma.$queryRaw<any[]>`
            SELECT 
              sa.id,
              sa.uuid,
              sa.counteragent_uuid,
              sa.financial_code_uuid,
              sa.nominal_currency_uuid,
              sa.payment_id,
              sa.salary_month,
              sa.net_sum,
              sa.surplus_insurance,
              sa.deducted_insurance,
              sa.deducted_fitness,
              sa.deducted_fine,
              sa.created_at,
              sa.updated_at,
              c.counteragent as counteragent_name,
              c.identification_number,
              c.sex,
              c.pension_scheme,
              c.department,
              fc.validation as financial_code,
              cur.code as currency_code
            FROM salary_accruals sa
            LEFT JOIN counteragents c ON sa.counteragent_uuid = c.counteragent_uuid
            LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
            LEFT JOIN currencies cur ON sa.nominal_currency_uuid = cur.uuid
            WHERE sa.id IN (${Prisma.join(createdIds)})
          `
        : [];

      const formatted = createdRecords.map((accrual) => ({
        ...accrual,
        id: accrual.id.toString(),
        net_sum: accrual.net_sum.toString(),
        ...serializeInsuranceValues({
          surplus_insurance: accrual.surplus_insurance,
          deducted_insurance: accrual.deducted_insurance,
        }),
        deducted_fitness: accrual.deducted_fitness?.toString() || null,
        deducted_fine: accrual.deducted_fine?.toString() || null,
      }));

      return NextResponse.json({ inserted: createdIds.length, base_count: baseRecords.length, records: formatted });
    }

    if (body?.action === 'copy-accrual') {
      const { source_id, target_months, created_by } = body;
      if (!source_id || !Array.isArray(target_months) || target_months.length === 0) {
        return NextResponse.json({ error: 'Missing source_id or target_months' }, { status: 400 });
      }

      const sourceRecord = await prisma.salary_accruals.findUnique({
        where: { id: BigInt(source_id) },
      });

      if (!sourceRecord) {
        return NextResponse.json({ error: 'Source accrual not found' }, { status: 404 });
      }

      const createdIds: bigint[] = [];
      const skippedMonths: string[] = [];
      for (const month of target_months) {
        // month is expected as YYYY-MM — use the last day of that month
        const [yearStr, monthStr] = month.split('-');
        const year = parseInt(yearStr, 10);
        const mon = parseInt(monthStr, 10);
        // Last day of month: day 0 of next month
        const lastDay = new Date(year, mon, 0);

        // Check if record already exists for this counteragent+financial_code+month
        const monthStart = new Date(year, mon - 1, 1);
        const monthEnd = new Date(year, mon, 1);
        const existing = await prisma.salary_accruals.count({
          where: {
            counteragent_uuid: sourceRecord.counteragent_uuid,
            financial_code_uuid: sourceRecord.financial_code_uuid,
            salary_month: { gte: monthStart, lt: monthEnd },
          },
        });
        if (existing > 0) {
          skippedMonths.push(month);
          continue;
        }

        const created = await prisma.salary_accruals.create({
          data: {
            counteragent_uuid: sourceRecord.counteragent_uuid,
            insider_uuid: sourceRecord.insider_uuid,
            financial_code_uuid: sourceRecord.financial_code_uuid,
            nominal_currency_uuid: sourceRecord.nominal_currency_uuid,
            payment_id: generatePaymentId(sourceRecord.counteragent_uuid, sourceRecord.financial_code_uuid, lastDay),
            salary_month: lastDay,
            net_sum: sourceRecord.net_sum,
            surplus_insurance: sourceRecord.surplus_insurance,
            deducted_insurance: null,
            deducted_fitness: sourceRecord.deducted_fitness,
            deducted_fine: sourceRecord.deducted_fine,
            created_by: created_by || 'user',
            updated_by: created_by || 'user',
          },
        });
        createdIds.push(created.id);
      }

      const createdRecords = createdIds.length
        ? await prisma.$queryRaw<any[]>`
            SELECT 
              sa.id,
              sa.uuid,
              sa.counteragent_uuid,
              sa.financial_code_uuid,
              sa.nominal_currency_uuid,
              sa.payment_id,
              sa.salary_month,
              sa.net_sum,
              sa.surplus_insurance,
              sa.deducted_insurance,
              sa.deducted_fitness,
              sa.deducted_fine,
              sa.created_at,
              sa.updated_at,
              c.counteragent as counteragent_name,
              c.identification_number,
              c.sex,
              c.pension_scheme,
              c.department,
              fc.validation as financial_code,
              cur.code as currency_code
            FROM salary_accruals sa
            LEFT JOIN counteragents c ON sa.counteragent_uuid = c.counteragent_uuid
            LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
            LEFT JOIN currencies cur ON sa.nominal_currency_uuid = cur.uuid
            WHERE sa.id IN (${Prisma.join(createdIds)})
          `
        : [];

      const formatted = createdRecords.map((accrual) => ({
        ...accrual,
        id: accrual.id.toString(),
        net_sum: accrual.net_sum.toString(),
        ...serializeInsuranceValues({
          surplus_insurance: accrual.surplus_insurance,
          deducted_insurance: accrual.deducted_insurance,
        }),
        deducted_fitness: accrual.deducted_fitness?.toString() || null,
        deducted_fine: accrual.deducted_fine?.toString() || null,
      }));

      return NextResponse.json({ inserted: createdIds.length, skipped: skippedMonths, records: formatted });
    }

    const {
      counteragent_uuid,
      financial_code_uuid,
      nominal_currency_uuid,
      insider_uuid,
      insiderUuid,
      salary_month,
      net_sum,
      surplus_insurance,
      deducted_insurance,
      deducted_fitness,
      deducted_fine,
      created_by,
    } = body;

    // Validate required fields
    if (!counteragent_uuid || !financial_code_uuid || !nominal_currency_uuid || !salary_month || net_sum === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const requestedInsiderUuid = String(insiderUuid ?? insider_uuid ?? '').trim() || null;
    const insiderOptions = await getInsiderOptions();
    const insiderOptionSet = new Set(insiderOptions.map((option) => option.insiderUuid.toLowerCase()));
    if (requestedInsiderUuid && !insiderOptionSet.has(requestedInsiderUuid.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid insider selection' }, { status: 400 });
    }
    const effectiveInsiderUuid = requestedInsiderUuid || selection.primaryInsider?.insiderUuid || null;
    if (!effectiveInsiderUuid) {
      return NextResponse.json({ error: 'No insider configured' }, { status: 400 });
    }

    // Normalize to first of month to ensure consistent storage
    const salaryDate = new Date(salary_month);
    salaryDate.setUTCDate(1);
    const payment_id = generatePaymentId(counteragent_uuid, financial_code_uuid, salaryDate);
    const normalizedInsurance = normalizeInsuranceValues(
      parseNullableNumber(surplus_insurance),
      parseNullableNumber(deducted_insurance),
    );

    // Create the accrual
    const accrual = await prisma.salary_accruals.create({
      data: {
        counteragent_uuid,
        insider_uuid: effectiveInsiderUuid,
        financial_code_uuid,
        nominal_currency_uuid,
        payment_id,
        salary_month: salaryDate,
        net_sum: parseFloat(net_sum),
        surplus_insurance: normalizedInsurance.surplusInsurance,
        deducted_insurance: normalizedInsurance.deductedInsurance,
        deducted_fitness: deducted_fitness ? parseFloat(deducted_fitness) : null,
        deducted_fine: deducted_fine ? parseFloat(deducted_fine) : null,
        created_by: created_by || 'system',
        updated_by: created_by || 'system',
      },
    });

    return NextResponse.json({
      ...accrual,
      id: accrual.id.toString(),
      payment_id,
      ...serializeInsuranceValues({
        surplus_insurance: accrual.surplus_insurance,
        deducted_insurance: accrual.deducted_insurance,
      }),
    });
  } catch (error: any) {
    console.error('Error creating salary accrual:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sourceTables = await getSourceTables();
    const selection = await resolveInsiderSelection(request);
    const body = await request.json();
    const {
      id,
      counteragent_uuid,
      financial_code_uuid,
      nominal_currency_uuid,
      insider_uuid,
      insiderUuid,
      salary_month,
      net_sum,
      surplus_insurance,
      deducted_insurance,
      deducted_fitness,
      deducted_fine,
      updated_by,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const requestedInsiderUuid = String(insiderUuid ?? insider_uuid ?? '').trim() || null;
    const insiderOptions = await getInsiderOptions();
    const insiderOptionSet = new Set(insiderOptions.map((option) => option.insiderUuid.toLowerCase()));
    if (requestedInsiderUuid && !insiderOptionSet.has(requestedInsiderUuid.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid insider selection' }, { status: 400 });
    }
    const effectiveInsiderUuid = requestedInsiderUuid || selection.primaryInsider?.insiderUuid || null;
    if (!effectiveInsiderUuid) {
      return NextResponse.json({ error: 'No insider configured' }, { status: 400 });
    }

    const existing = await prisma.salary_accruals.findUnique({
      where: { id: BigInt(id) },
      select: { payment_id: true },
    });

    // Regenerate payment_id if key fields changed; normalize to first of month
    const salaryDate = new Date(salary_month);
    salaryDate.setUTCDate(1);
    const payment_id = generatePaymentId(counteragent_uuid, financial_code_uuid, salaryDate);
    const normalizedInsurance = normalizeInsuranceValues(
      parseNullableNumber(surplus_insurance),
      parseNullableNumber(deducted_insurance),
    );

    const accrual = await prisma.salary_accruals.update({
      where: { id: BigInt(id) },
      data: {
        counteragent_uuid,
        insider_uuid: effectiveInsiderUuid,
        financial_code_uuid,
        nominal_currency_uuid,
        payment_id,
        salary_month: salaryDate,
        net_sum: parseFloat(net_sum),
        surplus_insurance: normalizedInsurance.surplusInsurance,
        deducted_insurance: normalizedInsurance.deductedInsurance,
        deducted_fitness: deducted_fitness ? parseFloat(deducted_fitness) : null,
        deducted_fine: deducted_fine ? parseFloat(deducted_fine) : null,
        updated_at: new Date(),
        updated_by: updated_by || 'system',
      },
    });

    const oldPaymentId = existing?.payment_id || null;
    if (oldPaymentId && payment_id) {
      await remapPaymentIdBindings(oldPaymentId, payment_id, sourceTables);
    }

    return NextResponse.json({
      ...accrual,
      id: accrual.id.toString(),
      ...serializeInsuranceValues({
        surplus_insurance: accrual.surplus_insurance,
        deducted_insurance: accrual.deducted_insurance,
      }),
    });
  } catch (error: any) {
    console.error('Error updating salary accrual:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.salary_accruals.delete({
      where: { id: BigInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting salary accrual:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

