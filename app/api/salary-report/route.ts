import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const DECONSOLIDATED_TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE74BG0000000586388146_BOG_USD',
  'GE78BG0000000893486000_BOG_USD',
  'GE78BG0000000893486000_BOG_EUR',
  'GE78BG0000000893486000_BOG_AED',
  'GE78BG0000000893486000_BOG_GBP',
  'GE78BG0000000893486000_BOG_KZT',
  'GE78BG0000000893486000_BOG_CNY',
  'GE78BG0000000893486000_BOG_TRY',
  'GE65TB7856036050100002_TBC_GEL',
] as const;

const normalizePaymentKey = (value: string) => {
  const trimmed = value.trim();
  const base = trimmed.includes(':') ? trimmed.split(':')[0] : trimmed;
  return base.toLowerCase();
};

// Extract YYYY-MM period from a salary payment_id (format: ...PRL{MM}{YYYY})
const extractPeriodFromPaymentId = (paymentId: string): string | null => {
  const match = paymentId.match(/prl(\d{2})(\d{4})$/i);
  if (!match) return null;
  const month = match[1];
  const year = match[2];
  return `${year}-${month}`;
};

// Build a last-day-of-month date string for a YYYY-MM period
const periodToDate = (period: string): string => {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

// Generate payment_id matching salary accruals pattern
const generatePaymentId = (counteragentUuid: string, financialCodeUuid: string, salaryMonth: Date): string => {
  const extractChars = (uuid: string) => uuid[1] + uuid[3] + uuid[5] + uuid[7] + uuid[9] + uuid[11];
  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financialCodeUuid);
  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
};

const parseTxDate = (raw: string): string => {
  if (!raw) return '';
  // Handle DD.MM.YYYY format
  if (raw.includes('.')) {
    const parts = raw.split('.');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return raw;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const counteragentUuid = searchParams.get('counteragentUuid');
    const mode = searchParams.get('mode') || 'total'; // 'total' | 'all'

    if (!counteragentUuid) {
      return NextResponse.json({ error: 'Missing counteragentUuid parameter' }, { status: 400 });
    }

    // Fetch counteragent details
    const counteragent = await prisma.$queryRaw<any[]>`
      SELECT 
        c.counteragent_uuid,
        c.counteragent as name,
        c.identification_number,
        c.sex,
        c.pension_scheme,
        c.iban
      FROM counteragents c
      WHERE c.counteragent_uuid = ${counteragentUuid}::uuid
      LIMIT 1
    `;

    if (!counteragent || counteragent.length === 0) {
      return NextResponse.json({ error: 'Counteragent not found' }, { status: 404 });
    }

    const ca = counteragent[0];

    // Fetch all salary accruals for this counteragent, ordered chronologically
    const accruals = await prisma.$queryRaw<any[]>`
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
        sa.confirmed,
        sa.created_at,
        sa.updated_at,
        c.pension_scheme,
        fc.validation as financial_code,
        cur.code as currency_code
      FROM salary_accruals sa
      LEFT JOIN counteragents c ON sa.counteragent_uuid = c.counteragent_uuid
      LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
      LEFT JOIN currencies cur ON sa.nominal_currency_uuid = cur.uuid
      WHERE sa.counteragent_uuid = ${counteragentUuid}::uuid
      ORDER BY sa.salary_month ASC, sa.created_at ASC
    `;

    // ===================== Detect paid periods with no accrual record =====================
    // Fetch all payment_ids from bank for this counteragent
    const allPaymentIds = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT lower(trim(split_part(payment_id, ':', 1))) as payment_id_key
      FROM (
        ${Prisma.raw(DECONSOLIDATED_TABLES.map((tableName) => `
        SELECT cba.payment_id
        FROM "${tableName}" cba
        WHERE cba.counteragent_uuid = '${counteragentUuid}'
        AND cba.payment_id IS NOT NULL AND cba.payment_id <> ''
        AND cba.payment_id NOT ILIKE 'BTC_%'
        AND NOT EXISTS (
          SELECT 1 FROM bank_transaction_batches btb
          WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
        )`).join(' UNION ALL '))}
        UNION ALL
        ${Prisma.raw(DECONSOLIDATED_TABLES.map((tableName) => `
        SELECT COALESCE(
          CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
          p.payment_id
        ) as payment_id
        FROM "${tableName}" cba
        JOIN bank_transaction_batches btb ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
        LEFT JOIN payments p ON (
          btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
        ) OR (
          btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
        )
        WHERE cba.counteragent_uuid = '${counteragentUuid}'`).join(' UNION ALL '))}
      ) tx
      WHERE payment_id IS NOT NULL AND payment_id <> ''
    `;

    // Build set of existing accrual periods (YYYY-MM)
    const existingPeriods = new Set<string>();
    for (const accrual of accruals) {
      if (accrual.salary_month) {
        const d = new Date(accrual.salary_month);
        if (!isNaN(d.getTime())) {
          existingPeriods.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      }
    }

    // Find paid periods that don't have accrual records
    const missingPeriods = new Set<string>();
    for (const row of allPaymentIds) {
      const pid = String(row.payment_id_key || '');
      const period = extractPeriodFromPaymentId(pid);
      if (period && !existingPeriods.has(period)) {
        missingPeriods.add(period);
      }
    }

    // Generate projected accruals by copying last actual record
    if (missingPeriods.size > 0 && accruals.length > 0) {
      const lastAccrual = accruals[accruals.length - 1];
      const sortedMissing = Array.from(missingPeriods).sort();
      for (const period of sortedMissing) {
        const projectedDate = periodToDate(period);
        const [yearStr, monthStr] = period.split('-');
        // Generate the payment_id for this projected period
        const projectedPaymentId = generatePaymentId(
          String(lastAccrual.counteragent_uuid),
          String(lastAccrual.financial_code_uuid),
          new Date(Number(yearStr), Number(monthStr) - 1, 1)
        );
        accruals.push({
          ...lastAccrual,
          id: `projected-${period}`,
          uuid: `projected-${period}`,
          salary_month: projectedDate,
          payment_id: projectedPaymentId,
          confirmed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _projected: true,
        });
      }
      // Re-sort by salary_month
      accruals.sort((a: any, b: any) => {
        const da = a.salary_month ? new Date(a.salary_month).getTime() : 0;
        const db = b.salary_month ? new Date(b.salary_month).getTime() : 0;
        return da - db;
      });
    }

    // ===================== MODE: ALL =====================
    if (mode === 'all') {
      // Fetch individual payment transactions with actual transaction dates
      const individualPayments = await prisma.$queryRaw<any[]>`
        SELECT
          transaction_date,
          payment_id,
          ABS(nominal_amount)::numeric as amount,
          nominal_currency_uuid
        FROM (
          ${Prisma.raw(DECONSOLIDATED_TABLES.map((tableName) => `
          SELECT
            cba.transaction_date,
            cba.payment_id,
            cba.nominal_amount,
            cba.nominal_currency_uuid
          FROM "${tableName}" cba
          WHERE cba.counteragent_uuid = '${counteragentUuid}'
          AND NOT EXISTS (
            SELECT 1 FROM bank_transaction_batches btb
            WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
          )
          AND cba.payment_id NOT ILIKE 'BTC_%'
          AND cba.payment_id IS NOT NULL AND cba.payment_id <> ''`).join(' UNION ALL '))}
          UNION ALL
          ${Prisma.raw(DECONSOLIDATED_TABLES.map((tableName) => `
          SELECT
            cba.transaction_date,
            COALESCE(
              CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
              p.payment_id
            ) as payment_id,
            (COALESCE(NULLIF(btb.nominal_amount, 0), btb.partition_amount) * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount,
            COALESCE(btb.nominal_currency_uuid, p.currency_uuid, cba.nominal_currency_uuid) as nominal_currency_uuid
          FROM "${tableName}" cba
          JOIN bank_transaction_batches btb
            ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
          LEFT JOIN payments p
            ON (
              btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
            ) OR (
              btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
            )
          WHERE cba.counteragent_uuid = '${counteragentUuid}'`).join(' UNION ALL '))}
        ) tx
        WHERE payment_id IS NOT NULL AND payment_id <> ''
        ORDER BY transaction_date ASC
      `;

      // Build set of salary payment_ids for filtering
      const salaryPaymentKeys = new Set<string>();
      for (const accrual of accruals) {
        if (accrual.payment_id) {
          salaryPaymentKeys.add(normalizePaymentKey(String(accrual.payment_id)));
        }
      }

      // Build accrual entries (type=accrual) sorted by salary_month
      const pensionScheme = Boolean(ca.pension_scheme);
      const accrualEntries = accruals.map((accrual) => {
        const netSum = Number(accrual.net_sum) || 0;
        const adjustedNetSum = netSum * (pensionScheme ? 0.98 : 1);
        return {
          type: 'accrual' as const,
          date: accrual.salary_month ? (typeof accrual.salary_month === 'string' ? accrual.salary_month : new Date(accrual.salary_month).toISOString().slice(0, 10)) : '',
          payment_id: accrual.payment_id || '',
          accrual: adjustedNetSum,
          payment: 0,
          surplus_insurance: accrual.surplus_insurance !== null ? Number(accrual.surplus_insurance) : null,
          deducted_insurance: accrual.deducted_insurance !== null ? Number(accrual.deducted_insurance) : null,
          deducted_fitness: accrual.deducted_fitness !== null ? Number(accrual.deducted_fitness) : null,
          deducted_fine: accrual.deducted_fine !== null ? Number(accrual.deducted_fine) : null,
          currency_code: accrual.currency_code,
          projected: Boolean((accrual as any)._projected),
        };
      });

      // Build payment entries (type=payment), only for salary payment_ids
      const paymentEntries = individualPayments
        .filter(tx => {
          const pid = tx.payment_id ? normalizePaymentKey(String(tx.payment_id)) : '';
          return pid && salaryPaymentKeys.has(pid);
        })
        .map(tx => ({
          type: 'payment' as const,
          date: parseTxDate(String(tx.transaction_date || '')),
          payment_id: tx.payment_id || '',
          accrual: 0,
          payment: tx.amount ? Math.abs(Number(tx.amount)) : 0,
          surplus_insurance: null as number | null,
          deducted_insurance: null as number | null,
          deducted_fitness: null as number | null,
          deducted_fine: null as number | null,
          currency_code: null as string | null,
          projected: false,
        }));

      // Merge and sort chronologically
      const allEntries = [...accrualEntries, ...paymentEntries].sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (da < db) return -1;
        if (da > db) return 1;
        // Accruals before payments on the same date
        if (a.type === 'accrual' && b.type === 'payment') return -1;
        if (a.type === 'payment' && b.type === 'accrual') return 1;
        return 0;
      });

      // Compute running cumulatives
      let cumulativeAccrual = 0;
      let cumulativePayment = 0;
      const ledgerRows = allEntries.map((entry, idx) => {
        cumulativeAccrual += entry.accrual;
        cumulativePayment += entry.payment;
        return {
          ...entry,
          id: `${entry.type}-${idx}`,
          cumulative_accrual: cumulativeAccrual,
          cumulative_payment: cumulativePayment,
          cumulative_balance: cumulativeAccrual - cumulativePayment,
          projected: entry.projected || false,
        };
      });

      const totalAccrual = accrualEntries.reduce((s, e) => s + e.accrual, 0);
      const totalPayment = paymentEntries.reduce((s, e) => s + e.payment, 0);

      return NextResponse.json({
        counteragent: {
          uuid: ca.counteragent_uuid,
          name: ca.name,
          identification_number: ca.identification_number,
          sex: ca.sex,
          pension_scheme: ca.pension_scheme,
          iban: ca.iban,
        },
        ledgerRows,
        totals: {
          accrual: totalAccrual,
          payment: totalPayment,
          balance: totalAccrual - totalPayment,
        },
        currency: accruals.length > 0 ? accruals[0].currency_code : null,
        mode: 'all',
      });
    }

    // ===================== MODE: TOTAL (default) =====================
    const paidRows = await prisma.$queryRaw<any[]>`
      SELECT
        lower(trim(split_part(payment_id, ':', 1))) as payment_id_key,
        counteragent_uuid,
        nominal_currency_uuid,
        ABS(SUM(nominal_amount))::numeric as paid
      FROM (
        ${Prisma.raw(DECONSOLIDATED_TABLES.map((tableName) => `
        SELECT
          cba.payment_id,
          cba.counteragent_uuid,
          cba.nominal_currency_uuid,
          cba.nominal_amount
        FROM "${tableName}" cba
        WHERE cba.counteragent_uuid = '${counteragentUuid}'
        AND NOT EXISTS (
          SELECT 1 FROM bank_transaction_batches btb
          WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
        )
        AND cba.payment_id NOT ILIKE 'BTC_%'`).join(' UNION ALL '))}
        UNION ALL
        ${Prisma.raw(DECONSOLIDATED_TABLES.map((tableName) => `
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
          )
        WHERE cba.counteragent_uuid = '${counteragentUuid}'`).join(' UNION ALL '))}
      ) tx
      WHERE payment_id IS NOT NULL AND payment_id <> ''
      GROUP BY lower(trim(split_part(payment_id, ':', 1))), counteragent_uuid, nominal_currency_uuid
    `;

    const paidMap = new Map<string, number>();
    const paidByPayment = new Map<string, number>();
    const currencySetMap = new Map<string, Set<string>>();
    for (const row of paidRows) {
      const paymentKey = String(row.payment_id_key || '').trim();
      if (!paymentKey) continue;
      const caKey = row.counteragent_uuid ? String(row.counteragent_uuid) : '';
      const currencyKey = row.nominal_currency_uuid ? String(row.nominal_currency_uuid) : '';
      const amount = row.paid ? Number(row.paid) : 0;
      const compositeKey = `${paymentKey}|${caKey}`;
      paidMap.set(`${compositeKey}|${currencyKey}`, amount);
      paidByPayment.set(compositeKey, (paidByPayment.get(compositeKey) || 0) + amount);
      if (!currencySetMap.has(compositeKey)) {
        currencySetMap.set(compositeKey, new Set());
      }
      currencySetMap.get(compositeKey)!.add(currencyKey);
    }

    // Format accruals with paid amounts and compute cumulatives
    const rows = accruals.map((accrual) => {
      const paymentKey = normalizePaymentKey(String(accrual.payment_id || ''));
      const caKey = accrual.counteragent_uuid ? String(accrual.counteragent_uuid) : '';
      const compositeKey = `${paymentKey}|${caKey}`;
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

      const netSum = Number(accrual.net_sum) || 0;
      const pensionScheme = Boolean(accrual.pension_scheme);
      // Net sum adjusted for pension scheme
      const adjustedNetSum = netSum * (pensionScheme ? 0.98 : 1);
      const surplusInsurance = accrual.surplus_insurance !== null ? Number(accrual.surplus_insurance) : null;
      const deductedInsurance = accrual.deducted_insurance !== null ? Number(accrual.deducted_insurance) : null;
      const deductedFitness = accrual.deducted_fitness !== null ? Number(accrual.deducted_fitness) : null;
      const deductedFine = accrual.deducted_fine !== null ? Number(accrual.deducted_fine) : null;
      const monthBalance = adjustedNetSum - paid;

      return {
        id: accrual.id.toString(),
        payment_id: accrual.payment_id,
        salary_month: accrual.salary_month,
        net_sum: adjustedNetSum,
        raw_net_sum: netSum,
        surplus_insurance: surplusInsurance,
        deducted_insurance: deductedInsurance,
        deducted_fitness: deductedFitness,
        deducted_fine: deductedFine,
        paid,
        month_balance: monthBalance,
        financial_code: accrual.financial_code,
        currency_code: accrual.currency_code,
        confirmed: Boolean(accrual.confirmed),
        pension_scheme: pensionScheme,
        projected: Boolean((accrual as any)._projected),
      };
    });

    // Compute cumulatives
    let cumulativeAccrual = 0;
    let cumulativePayment = 0;
    for (const row of rows) {
      cumulativeAccrual += row.net_sum;
      cumulativePayment += row.paid;
      (row as any).cumulative_accrual = cumulativeAccrual;
      (row as any).cumulative_payment = cumulativePayment;
      (row as any).cumulative_balance = cumulativeAccrual - cumulativePayment;
    }

    // Compute totals
    const totals = {
      net_sum: rows.reduce((s, r) => s + r.net_sum, 0),
      surplus_insurance: rows.reduce((s, r) => s + (r.surplus_insurance || 0), 0),
      deducted_insurance: rows.reduce((s, r) => s + (r.deducted_insurance || 0), 0),
      deducted_fitness: rows.reduce((s, r) => s + (r.deducted_fitness || 0), 0),
      deducted_fine: rows.reduce((s, r) => s + (r.deducted_fine || 0), 0),
      paid: rows.reduce((s, r) => s + r.paid, 0),
      month_balance: rows.reduce((s, r) => s + r.month_balance, 0),
    };

    return NextResponse.json({
      counteragent: {
        uuid: ca.counteragent_uuid,
        name: ca.name,
        identification_number: ca.identification_number,
        sex: ca.sex,
        pension_scheme: ca.pension_scheme,
        iban: ca.iban,
      },
      rows,
      totals,
      currency: rows.length > 0 ? rows[0].currency_code : null,
      mode: 'total',
    });
  } catch (error: any) {
    console.error('Salary report error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
