import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const SOURCE_TABLES = [
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
];

const parseUuidList = (value: string | null) => {
  if (!value) return [] as string[];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => uuidRegex.test(item));
};

const parseIsoDate = (value: string | null) => {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const financialCodeUuids = parseUuidList(searchParams.get('financialCodeUuids'));
    const maxDate = parseIsoDate(searchParams.get('maxDate'));

    if (financialCodeUuids.length === 0) {
      return NextResponse.json({
        rows: [],
        summaryByStatus: [],
        totals: {
          projectsCount: 0,
          jobsCount: 0,
          paymentCount: 0,
          accrual: 0,
          order: 0,
          payment: 0,
          due: 0,
          balance: 0,
        },
      });
    }

    const ledgerDateFilter = maxDate ? `AND pl.effective_date::date <= '${maxDate}'::date` : '';
    const bankDateFilter = maxDate ? `AND transaction_date::date <= '${maxDate}'::date` : '';

    const rawUnionBankQuery = SOURCE_TABLES.length
      ? SOURCE_TABLES.map((table) => (
          `SELECT
             raw_record_uuid::text AS raw_record_uuid,
             payment_id::text AS payment_id,
             nominal_amount::numeric AS nominal_amount,
             transaction_date::date AS transaction_date,
             account_currency_amount::numeric AS account_currency_amount
           FROM "${table}"`
        )).join(' UNION ALL ')
      : 'SELECT NULL::text AS raw_record_uuid, NULL::text AS payment_id, NULL::numeric AS nominal_amount, NULL::date AS transaction_date, NULL::numeric AS account_currency_amount WHERE false';

    const financialCodePlaceholders = financialCodeUuids.map((_, index) => `$${index + 1}::uuid`).join(', ');

    const query = `
      WITH raw_union_bank AS (
        ${rawUnionBankQuery}
      ),
      selected_payments AS (
        SELECT
          p.payment_id,
          p.project_uuid,
          p.counteragent_uuid,
          p.currency_uuid,
          p.financial_code_uuid,
          COALESCE(fc.validation, fc.code, '-') as financial_code_validation,
          proj.project_index,
          proj.project_name,
          proj.value as project_amount,
          COALESCE(ps.name, proj.state, 'Unknown') as status_name,
          COALESCE(ca.counteragent, ca.name, '-') as counteragent_name,
          curr.code as currency_code
        FROM payments p
        LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
        LEFT JOIN project_states ps ON proj.state_uuid = ps.uuid
        LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
        LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
        LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
        WHERE p.is_active = true
          AND p.financial_code_uuid IN (${financialCodePlaceholders})
      ),
      jobs_per_project AS (
        SELECT
          j.project_uuid,
          COUNT(*) as jobs_count
        FROM jobs j
        WHERE j.is_active = true
        GROUP BY j.project_uuid
      ),
      ledger_agg AS (
        SELECT
          pl.payment_id,
          SUM(COALESCE(pl.accrual, 0)) as total_accrual,
          SUM(COALESCE(pl."order", 0)) as total_order,
          BOOL_AND(COALESCE(pl.confirmed, false)) as all_confirmed,
          COUNT(*) as entries_count,
          MAX(pl.effective_date) as latest_ledger_date
        FROM payments_ledger pl
        WHERE (pl.is_deleted = false OR pl.is_deleted IS NULL)
          ${ledgerDateFilter}
        GROUP BY pl.payment_id
      ),
      bank_agg AS (
        SELECT
          payment_id,
          SUM(nominal_amount) as total_payment,
          MAX(transaction_date::date) as latest_bank_date
        FROM (
          SELECT
            cba.payment_id,
            cba.nominal_amount,
            cba.transaction_date
          FROM raw_union_bank cba
          WHERE NOT EXISTS (
            SELECT 1 FROM bank_transaction_batches btb
            WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
          )
          AND cba.payment_id NOT ILIKE 'BTC_%'

          UNION ALL

          SELECT
            COALESCE(
              CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
              p.payment_id
            ) as payment_id,
            (COALESCE(NULLIF(btb.nominal_amount, 0), btb.partition_amount) * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount,
            cba.transaction_date
          FROM raw_union_bank cba
          JOIN bank_transaction_batches btb
            ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
          LEFT JOIN payments p
            ON (
              btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
            ) OR (
              btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
            )
        ) combined
        WHERE payment_id IS NOT NULL AND payment_id <> ''
        ${bankDateFilter}
        GROUP BY payment_id
      )
      SELECT
        sp.financial_code_uuid,
        COALESCE(MAX(sp.financial_code_validation), '-') as financial_code_validation,
        sp.project_uuid,
        CASE
          WHEN COUNT(DISTINCT sp.counteragent_uuid) = 1 THEN MIN(sp.counteragent_uuid)
          ELSE NULL
        END as counteragent_uuid,
        COALESCE(MAX(sp.status_name), 'Unknown') as status_name,
        COALESCE(MAX(sp.project_index), '-') as project_index,
        COALESCE(MAX(sp.project_name), '-') as project_name,
        COALESCE(MAX(sp.project_amount), 0) as project_amount,
        COALESCE(MAX(sp.counteragent_name), '-') as counteragent_name,
        COALESCE(MAX(sp.currency_code), '-') as currency_code,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT sp.payment_id ORDER BY sp.payment_id), NULL) as payment_ids,
        COUNT(DISTINCT sp.payment_id) as payment_count,
        COALESCE(MAX(jpp.jobs_count), 0) as jobs_count,
        SUM(COALESCE(la.total_accrual, 0)) as accrual,
        SUM(COALESCE(la.total_order, 0)) as "order",
        SUM(COALESCE(ba.total_payment, 0)) as payment,
        BOOL_AND(
          CASE
            WHEN COALESCE(la.entries_count, 0) > 0 THEN COALESCE(la.all_confirmed, false)
            ELSE false
          END
        ) as confirmed,
        COALESCE(
          GREATEST(MAX(la.latest_ledger_date), MAX(ba.latest_bank_date)),
          MAX(la.latest_ledger_date),
          MAX(ba.latest_bank_date)
        ) as latest_date
      FROM selected_payments sp
      LEFT JOIN ledger_agg la ON sp.payment_id = la.payment_id
      LEFT JOIN bank_agg ba ON sp.payment_id = ba.payment_id
      LEFT JOIN jobs_per_project jpp ON sp.project_uuid = jpp.project_uuid
      GROUP BY sp.financial_code_uuid, sp.project_uuid
      ORDER BY financial_code_validation ASC, status_name ASC, project_index ASC
    `;

    const rows = await prisma.$queryRawUnsafe<any[]>(query, ...financialCodeUuids);

    const formattedRows = rows.map((row) => {
      const accrual = Number(row.accrual || 0);
      const order = Number(row.order || 0);
      const payment = Number(row.payment || 0);
      const due = Number((order - Math.abs(payment)).toFixed(2));
      const balance = Number((accrual - Math.abs(payment)).toFixed(2));
      return {
        financialCodeUuid: row.financial_code_uuid,
        financialCodeValidation: row.financial_code_validation,
        projectUuid: row.project_uuid,
        counteragentUuid: row.counteragent_uuid || null,
        status: row.status_name,
        project: row.project_index,
        projectName: row.project_name,
        sum: Number(row.project_amount || 0),
        counteragent: row.counteragent_name,
        paymentIds: Array.isArray(row.payment_ids)
          ? row.payment_ids.filter((value: unknown) => typeof value === 'string' && value.trim() !== '')
          : [],
        currency: row.currency_code,
        paymentCount: Number(row.payment_count || 0),
        jobsCount: Number(row.jobs_count || 0),
        accrual,
        order,
        payment,
        due,
        balance,
        confirmed: Boolean(row.confirmed),
        latestDate: row.latest_date || null,
      };
    });

    const summaryMap = new Map<string, {
      status: string;
      projectsCount: number;
      jobsCount: number;
      paymentCount: number;
      accrual: number;
      order: number;
      payment: number;
      due: number;
      balance: number;
    }>();

    for (const row of formattedRows) {
      const key = row.status || 'Unknown';
      const prev = summaryMap.get(key) || {
        status: key,
        projectsCount: 0,
        jobsCount: 0,
        paymentCount: 0,
        accrual: 0,
        order: 0,
        payment: 0,
        due: 0,
        balance: 0,
      };
      summaryMap.set(key, {
        status: key,
        projectsCount: prev.projectsCount + 1,
        jobsCount: prev.jobsCount + row.jobsCount,
        paymentCount: prev.paymentCount + row.paymentCount,
        accrual: prev.accrual + row.accrual,
        order: prev.order + row.order,
        payment: prev.payment + row.payment,
        due: Number((prev.due + row.due).toFixed(2)),
        balance: Number((prev.balance + row.balance).toFixed(2)),
      });
    }

    const summaryByStatus = Array.from(summaryMap.values()).sort((a, b) => a.status.localeCompare(b.status));

    const totals = formattedRows.reduce(
      (acc, row) => ({
        projectsCount: acc.projectsCount + 1,
        jobsCount: acc.jobsCount + row.jobsCount,
        paymentCount: acc.paymentCount + row.paymentCount,
        accrual: acc.accrual + row.accrual,
        order: acc.order + row.order,
        payment: acc.payment + row.payment,
        due: Number((acc.due + row.due).toFixed(2)),
        balance: Number((acc.balance + row.balance).toFixed(2)),
      }),
      {
        projectsCount: 0,
        jobsCount: 0,
        paymentCount: 0,
        accrual: 0,
        order: 0,
        payment: 0,
        due: 0,
        balance: 0,
      }
    );

    return NextResponse.json({
      rows: formattedRows,
      summaryByStatus,
      totals,
    });
  } catch (error: any) {
    console.error('Error fetching services report:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
