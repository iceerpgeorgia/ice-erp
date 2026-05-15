import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSourceTables } from '@/lib/source-tables';

export const revalidate = 0;

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
    const projectUuids = parseUuidList(searchParams.get('projectUuids'));
    const insiderUuids = parseUuidList(searchParams.get('insiderUuids'));
    const maxDate = parseIsoDate(searchParams.get('maxDate'));
    const rawTargetCurrency = searchParams.get('targetCurrency') || '';
    const targetCurrency = (['USD', 'GEL', 'EUR'].includes(rawTargetCurrency) ? rawTargetCurrency : 'GEL') as 'USD' | 'GEL' | 'EUR';
    const sourceTables = await getSourceTables(insiderUuids.length > 0 ? insiderUuids : undefined);

    if (projectUuids.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const ledgerDateFilter = maxDate ? `AND pl.effective_date::date <= '${maxDate}'::date` : '';
    const bankDateFilter = maxDate ? `AND combined.transaction_date::date <= '${maxDate}'::date` : '';

    const referenceDate = maxDate ? new Date(`${maxDate}T00:00:00.000Z`) : new Date();
    const lastMonthStartDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1));
    const monthStartDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
    const monthStart = monthStartDate.toISOString().slice(0, 10);
    const lastMonthStart = lastMonthStartDate.toISOString().slice(0, 10);

    const rawUnionBankQuery = sourceTables.length
      ? sourceTables.map((table) => (
          `SELECT
             raw_record_uuid::text AS raw_record_uuid,
             counteragent_uuid::uuid AS counteragent_uuid,
             payment_id::text AS payment_id,
             nominal_amount::numeric AS nominal_amount,
             transaction_date::date AS transaction_date,
             account_currency_amount::numeric AS account_currency_amount
           FROM "${table}"`
        )).join(' UNION ALL ')
      : 'SELECT NULL::text AS raw_record_uuid, NULL::uuid AS counteragent_uuid, NULL::text AS payment_id, NULL::numeric AS nominal_amount, NULL::date AS transaction_date, NULL::numeric AS account_currency_amount WHERE false';

    const projectPlaceholders = projectUuids.map((_, i) => `$${i + 1}::uuid`).join(', ');
    const insiderOffset = projectUuids.length;
    const insiderPlaceholders = insiderUuids.map((_, i) => `$${insiderOffset + i + 1}::uuid`).join(', ');
    const insiderFilter = insiderUuids.length > 0
      ? `AND proj.insider_uuid IN (${insiderPlaceholders})`
      : '';
    const queryParams = [...projectUuids, ...insiderUuids];

    // Generates a SQL conversion-factor expression: source_currency→target_currency using NBG rates.
    // source_rate / target_rate (both looked up from the same NBG row by entry date).
    const convFactor = (currCol: string, nbg: string) => {
      const srcRate = `CASE ${currCol} WHEN 'GEL' THEN 1.0 WHEN 'USD' THEN COALESCE(${nbg}.usd_rate, 1.0) WHEN 'EUR' THEN COALESCE(${nbg}.eur_rate, 1.0) ELSE 1.0 END::numeric`;
      const tgtRate = targetCurrency === 'GEL' ? '1.0::numeric' : `COALESCE(${nbg}.${targetCurrency.toLowerCase()}_rate, 1.0)::numeric`;
      return `(${srcRate} / NULLIF(${tgtRate}, 0))`;
    };

    const query = `
      WITH raw_union_bank AS (
        ${rawUnionBankQuery}
      ),
      selected_payments AS (
        SELECT
          p.payment_id,
          p.project_uuid,
          p.job_uuid,
          p.financial_code_uuid,
          COALESCE(fc.validation, fc.code, '-') AS financial_code_validation,
          COALESCE(fc.code, '-') AS financial_code_code,
          COALESCE(fc.is_income, false) AS financial_code_is_income,
          proj.project_index,
          proj.project_name,
          proj.address AS project_address,
          COALESCE(proj.service_state, '-') AS service_state,
          COALESCE(ps.name, proj.state, 'Unknown') AS status_name,
          COALESCE(j.job_name, NULL) AS job_name,
          COALESCE(insider_ca.insider_name, insider_ca.name, insider_ca.counteragent, '-') AS insider_name,
          COALESCE(proj.department, '-') AS department,
          COALESCE(j.floors, 0) AS job_floors
        FROM payments p
        LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
        LEFT JOIN project_states ps ON proj.state_uuid = ps.uuid
        LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
        LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
        LEFT JOIN counteragents insider_ca ON proj.insider_uuid = insider_ca.counteragent_uuid
        WHERE p.is_active = true
          AND p.project_uuid IN (${projectPlaceholders})
          ${insiderFilter}
      ),
      payment_currencies AS (
        SELECT
          p.payment_id,
          COALESCE(curr.code, 'GEL') AS currency_code
        FROM payments p
        LEFT JOIN currencies curr ON curr.uuid = p.currency_uuid
        WHERE p.is_active = true
          AND p.project_uuid IN (${projectPlaceholders})
      ),
      payment_tax_flags AS (
        SELECT
          p.payment_id,
          COALESCE(p.income_tax, false) AS income_tax,
          COALESCE(ca.pension_scheme, false) AS pension_scheme
        FROM payments p
        LEFT JOIN counteragents ca ON ca.counteragent_uuid = p.counteragent_uuid
        WHERE p.is_active = true
          AND p.project_uuid IN (${projectPlaceholders})
      ),
      ledger_agg AS (
        SELECT
          pl.payment_id,
          SUM(COALESCE(pl.accrual, 0) * ${convFactor('pc.currency_code', 'nbg_l')}) AS total_accrual,
          SUM(COALESCE(pl."order", 0) * ${convFactor('pc.currency_code', 'nbg_l')}) AS total_order,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pl.accrual, 0) * ${convFactor('pc.currency_code', 'nbg_l')} ELSE 0 END) AS total_accrual_tax,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pl."order", 0) * ${convFactor('pc.currency_code', 'nbg_l')} ELSE 0 END) AS total_order_tax,
          BOOL_OR(CASE WHEN ptf.income_tax THEN ptf.pension_scheme ELSE false END) AS pension_on_tax,
          BOOL_AND(COALESCE(pl.confirmed, false)) AS all_confirmed,
          COUNT(*) AS entries_count,
          MAX(pl.effective_date) AS latest_ledger_date
        FROM payments_ledger pl
        LEFT JOIN payment_currencies pc ON pc.payment_id = pl.payment_id
        LEFT JOIN payment_tax_flags ptf ON ptf.payment_id = pl.payment_id
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= pl.effective_date::date ORDER BY date DESC LIMIT 1
        ) nbg_l ON true
        WHERE (pl.is_deleted = false OR pl.is_deleted IS NULL)
          ${ledgerDateFilter}
        GROUP BY pl.payment_id
      ),
      latest_ledger_date_per_payment AS (
        SELECT
          pl.payment_id,
          MAX(pl.effective_date) AS latest_effective_date
        FROM payments_ledger pl
        WHERE (pl.is_deleted = false OR pl.is_deleted IS NULL)
          ${ledgerDateFilter}
        GROUP BY pl.payment_id
      ),
      ledger_latest AS (
        SELECT
          pl.payment_id,
          SUM(COALESCE(pl.accrual, 0) * ${convFactor('pc.currency_code', 'nbg_ll')}) AS latest_accrual,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pl.accrual, 0) * ${convFactor('pc.currency_code', 'nbg_ll')} ELSE 0 END) AS latest_accrual_tax
        FROM payments_ledger pl
        JOIN latest_ledger_date_per_payment ldp
          ON ldp.payment_id = pl.payment_id
         AND ldp.latest_effective_date = pl.effective_date
        LEFT JOIN payment_currencies pc ON pc.payment_id = pl.payment_id
        LEFT JOIN payment_tax_flags ptf ON ptf.payment_id = pl.payment_id
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= pl.effective_date::date ORDER BY date DESC LIMIT 1
        ) nbg_ll ON true
        WHERE (pl.is_deleted = false OR pl.is_deleted IS NULL)
          ${ledgerDateFilter}
        GROUP BY pl.payment_id
      ),
      ledger_last_month AS (
        SELECT
          pl.payment_id,
          SUM(COALESCE(pl.accrual, 0) * ${convFactor('pc.currency_code', 'nbg_lm')}) AS total_accrual,
          SUM(COALESCE(pl."order", 0) * ${convFactor('pc.currency_code', 'nbg_lm')}) AS total_order,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pl.accrual, 0) * ${convFactor('pc.currency_code', 'nbg_lm')} ELSE 0 END) AS total_accrual_tax,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pl."order", 0) * ${convFactor('pc.currency_code', 'nbg_lm')} ELSE 0 END) AS total_order_tax
        FROM payments_ledger pl
        LEFT JOIN payment_currencies pc ON pc.payment_id = pl.payment_id
        LEFT JOIN payment_tax_flags ptf ON ptf.payment_id = pl.payment_id
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= pl.effective_date::date ORDER BY date DESC LIMIT 1
        ) nbg_lm ON true
        WHERE (pl.is_deleted = false OR pl.is_deleted IS NULL)
          AND pl.effective_date::date >= '${lastMonthStart}'::date
          AND pl.effective_date::date < '${monthStart}'::date
        GROUP BY pl.payment_id
      ),
      bank_agg AS (
        SELECT
          combined.payment_id,
          SUM(combined.nominal_amount * ${convFactor('pc.currency_code', 'nbg_b')}) AS total_payment,
          SUM(CASE WHEN ptf.income_tax THEN combined.nominal_amount * ${convFactor('pc.currency_code', 'nbg_b')} ELSE 0 END) AS total_payment_tax,
          MAX(combined.transaction_date::date) AS latest_bank_date
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
              p2.payment_id
            ) AS payment_id,
            (COALESCE(NULLIF(btb.nominal_amount, 0), btb.partition_amount) * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) AS nominal_amount,
            cba.transaction_date
          FROM raw_union_bank cba
          JOIN bank_transaction_batches btb
            ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
          LEFT JOIN payments p2
            ON (
              btb.payment_uuid IS NOT NULL AND p2.record_uuid = btb.payment_uuid
            ) OR (
              btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p2.payment_id = btb.payment_id
            )
        ) combined
        LEFT JOIN payment_currencies pc ON pc.payment_id = combined.payment_id
        LEFT JOIN payment_tax_flags ptf ON ptf.payment_id = combined.payment_id
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= combined.transaction_date::date ORDER BY date DESC LIMIT 1
        ) nbg_b ON true
        WHERE combined.payment_id IS NOT NULL AND combined.payment_id <> ''
        ${bankDateFilter}
        GROUP BY combined.payment_id
      ),
      adj_agg AS (
        SELECT
          pa.payment_id,
          SUM(COALESCE(pa.nominal_amount, pa.amount) * ${convFactor('pc.currency_code', 'nbg_a')}) AS total_adjustment,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pa.nominal_amount, pa.amount) * ${convFactor('pc.currency_code', 'nbg_a')} ELSE 0 END) AS total_adjustment_tax
        FROM payment_adjustments pa
        LEFT JOIN payment_currencies pc ON pc.payment_id = pa.payment_id
        LEFT JOIN payment_tax_flags ptf ON ptf.payment_id = pa.payment_id
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= pa.effective_date::date ORDER BY date DESC LIMIT 1
        ) nbg_a ON true
        WHERE (pa.is_deleted = false OR pa.is_deleted IS NULL)
        GROUP BY pa.payment_id
      ),
      waybill_agg AS (
        SELECT
          w.project_uuid::text AS project_uuid,
          SUM((COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END) * ${convFactor("'GEL'", 'nbg_w')}) AS waybill_sum
        FROM rs_waybills_in w
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= COALESCE(w.activation_time::date, CURRENT_DATE) ORDER BY date DESC LIMIT 1
        ) nbg_w ON true
        WHERE w.project_uuid IN (${projectPlaceholders})
          ${maxDate ? `AND COALESCE(w.activation_time::date, CURRENT_DATE) <= '${maxDate}'::date` : ''}
        GROUP BY w.project_uuid
      )
      SELECT
        sp.project_uuid,
        MAX(sp.project_index) AS project_index,
        MAX(sp.project_name) AS project_name,
        MAX(sp.project_address) AS project_address,
        MAX(sp.status_name) AS status_name,
        MAX(sp.service_state) AS service_state,
        MAX(sp.insider_name) AS insider_name,
        MAX(sp.department) AS department,
        sp.job_uuid,
        MAX(sp.job_name) AS job_name,
        sp.financial_code_uuid,
        MAX(sp.financial_code_validation) AS financial_code_validation,
        MAX(sp.financial_code_code) AS financial_code_code,
        MAX(sp.financial_code_is_income::int)::boolean AS financial_code_is_income,
        MAX(sp.job_floors) AS job_floors,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT sp.payment_id ORDER BY sp.payment_id), NULL) AS payment_ids,
        COUNT(DISTINCT sp.payment_id) AS payment_count,
        SUM(COALESCE(la.total_accrual, 0)) AS accrual,
        SUM(COALESCE(ll.latest_accrual, 0)) AS latest_accrual,
        SUM(COALESCE(la.total_order, 0)) AS "order",
        SUM(COALESCE(llm.total_accrual, 0)) AS last_month_accrual,
        SUM(COALESCE(llm.total_order, 0)) AS last_month_order,
        SUM(COALESCE(la.total_accrual_tax, 0)) AS accrual_tax,
        SUM(COALESCE(ll.latest_accrual_tax, 0)) AS latest_accrual_tax,
        SUM(COALESCE(la.total_order_tax, 0)) AS order_tax,
        SUM(COALESCE(llm.total_accrual_tax, 0)) AS last_month_accrual_tax,
        SUM(COALESCE(llm.total_order_tax, 0)) AS last_month_order_tax,
        SUM(COALESCE(ba.total_payment_tax, 0) + COALESCE(adj.total_adjustment_tax, 0)) AS payment_tax,
        BOOL_OR(COALESCE(la.pension_on_tax, false)) AS pension_on_tax,
        SUM(COALESCE(ba.total_payment, 0) + COALESCE(adj.total_adjustment, 0)) AS payment,
        BOOL_AND(
          CASE
            WHEN COALESCE(la.entries_count, 0) > 0 THEN COALESCE(la.all_confirmed, false)
            ELSE false
          END
        ) AS confirmed,
        MAX(la.latest_ledger_date) AS latest_date,
        COALESCE(MAX(wa.waybill_sum), 0) AS waybill_sum
      FROM selected_payments sp
      LEFT JOIN ledger_agg la ON sp.payment_id = la.payment_id
      LEFT JOIN ledger_latest ll ON sp.payment_id = ll.payment_id
      LEFT JOIN ledger_last_month llm ON sp.payment_id = llm.payment_id
      LEFT JOIN bank_agg ba ON sp.payment_id = ba.payment_id
      LEFT JOIN adj_agg adj ON sp.payment_id = adj.payment_id
      LEFT JOIN (
        SELECT uuid::text AS fc_uuid, default_code_fc::text AS default_cost_fc
        FROM financial_codes
        WHERE default_code_fc IS NOT NULL
      ) fc_pair ON fc_pair.fc_uuid = sp.financial_code_uuid::text
      LEFT JOIN waybill_agg wa
        ON wa.project_uuid = sp.project_uuid::text
       AND fc_pair.fc_uuid IS NOT NULL
      GROUP BY sp.project_uuid, sp.job_uuid, sp.financial_code_uuid
      ORDER BY MAX(sp.project_index) ASC, MAX(sp.job_name) ASC NULLS LAST, MAX(sp.financial_code_validation) ASC
    `;

    const rows = await prisma.$queryRawUnsafe<any[]>(query, ...queryParams);

    // Fetch all active jobs per project (not just those with payments)
    const allJobRows = await prisma.$queryRawUnsafe<{ project_uuid: string; job_uuid: string; job_name: string; floors: number }[]>(
      `SELECT project_uuid::text, job_uuid::text, COALESCE(job_name, '') AS job_name, COALESCE(floors, 0) AS floors
       FROM jobs
       WHERE project_uuid IN (${projectPlaceholders})
         AND is_active = true
       ORDER BY job_name ASC`,
      ...projectUuids
    );
    const allJobsByProject = new Map<string, { jobUuid: string; jobName: string; floors: number }[]>();
    const jobCountByProject = new Map<string, number>();
    for (const r of allJobRows) {
      if (!allJobsByProject.has(r.project_uuid)) allJobsByProject.set(r.project_uuid, []);
      allJobsByProject.get(r.project_uuid)!.push({ jobUuid: r.job_uuid, jobName: r.job_name, floors: r.floors });
    }
    for (const [uuid, jobs] of allJobsByProject) {
      jobCountByProject.set(uuid, jobs.length);
    }

    // Group rows by project
    const projectMap = new Map<string, {
      projectUuid: string;
      projectIndex: string;
      projectName: string;
      projectAddress: string | null;
      status: string;
      serviceState: string;
      insiderName: string;
      department: string;
      totalJobsInProject: number;
      allJobs: { jobUuid: string; jobName: string; floors: number }[];
      cells: {
        jobUuid: string | null;
        jobName: string | null;
        financialCodeUuid: string;
        financialCodeValidation: string;
        financialCodeCode: string;
        financialCodeIsIncome: boolean;
        accrual: number;
        latestAccrual: number;
        order: number;
        lastMonthAccrual: number;
        lastMonthOrder: number;
        payment: number;
        due: number;
        balance: number;
        confirmed: boolean;
        paymentCount: number;
        accrualPerFloor: number;
        jobFloors: number;
        paymentIds: string[];
        latestDate: string | null;
        accrualTax: number;
        latestAccrualTax: number;
        orderTax: number;
        lastMonthAccrualTax: number;
        lastMonthOrderTax: number;
        paymentTax: number;
        pensionOnTax: boolean;
        waybillSum: number;
      }[];
    }>();

    for (const row of rows) {
      const key = row.project_uuid as string;
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          projectUuid: key,
          projectIndex: row.project_index || '-',
          projectName: row.project_name || '-',
          projectAddress: row.project_address || null,
          status: row.status_name || 'Unknown',
          serviceState: row.service_state || '-',
          insiderName: row.insider_name || '-',
          department: row.department || '-',
          totalJobsInProject: jobCountByProject.get(key) ?? 0,
          allJobs: allJobsByProject.get(key) ?? [],
          cells: [],
        });
      }

      const accrual = Number(row.accrual || 0);
      const order = Number(row.order || 0);
      const payment = Number(row.payment || 0);
      const due = Number((order - Math.abs(payment)).toFixed(2));
      const balance = Number((accrual - Math.abs(payment)).toFixed(2));
      const floors = Number(row.job_floors || 0);
      const accrualPerFloor = floors > 0 ? Number((accrual / floors).toFixed(2)) : 0;

      projectMap.get(key)!.cells.push({
        jobUuid: row.job_uuid || null,
        jobName: row.job_name || null,
        financialCodeUuid: row.financial_code_uuid as string,
        financialCodeValidation: row.financial_code_validation as string,
        financialCodeCode: (row.financial_code_code as string) || '-',
        financialCodeIsIncome: Boolean(row.financial_code_is_income),
        accrual,
        latestAccrual: Number(row.latest_accrual || 0),
        order,
        lastMonthAccrual: Number(row.last_month_accrual || 0),
        lastMonthOrder: Number(row.last_month_order || 0),
        payment,
        due,
        balance,
        confirmed: Boolean(row.confirmed),
        paymentCount: Number(row.payment_count || 0),
        accrualPerFloor,
        jobFloors: floors,
        paymentIds: Array.isArray(row.payment_ids)
          ? row.payment_ids.filter((v: unknown) => typeof v === 'string' && v.trim() !== '')
          : [],
        latestDate: row.latest_date || null,
        accrualTax: Number(row.accrual_tax || 0),
        latestAccrualTax: Number(row.latest_accrual_tax || 0),
        orderTax: Number(row.order_tax || 0),
        lastMonthAccrualTax: Number(row.last_month_accrual_tax || 0),
        lastMonthOrderTax: Number(row.last_month_order_tax || 0),
        paymentTax: Number(row.payment_tax || 0),
        pensionOnTax: Boolean(row.pension_on_tax),
        waybillSum: Number(row.waybill_sum || 0),
      });
    }

    // Preserve the order of selected projects
    const projects = projectUuids
      .map((uuid) => projectMap.get(uuid))
      .filter(Boolean);

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('Error fetching projects report:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
