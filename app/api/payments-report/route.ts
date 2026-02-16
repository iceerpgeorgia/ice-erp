import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const SOURCE_TABLES = [
  "GE78BG0000000893486000_BOG_GEL",
  "GE65TB7856036050100002_TBC_GEL",
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const maxDate = searchParams.get('maxDate');

    const ledgerDateFilter = maxDate ? `WHERE effective_date::date <= '${maxDate}'::date` : '';
    const bankDateFilter = maxDate ? `AND transaction_date::date <= '${maxDate}'::date` : '';

    // Query to get payments with aggregated ledger data and actual payments from bank accounts
    // Use subqueries to prevent Cartesian product when payment has multiple ledger entries AND bank transactions
    const query = `
      WITH raw_union AS (
        ${SOURCE_TABLES.map((table) => `SELECT raw_record_uuid, counteragent_uuid, payment_id FROM "${table}"`).join(' UNION ALL ')}
      ),
      unbound_counteragent AS (
        SELECT
          counteragent_uuid,
          COUNT(*) as unbound_count
        FROM raw_union ru
        WHERE ru.counteragent_uuid IS NOT NULL
          AND (ru.payment_id IS NULL OR ru.payment_id = '')
          AND NOT EXISTS (
            SELECT 1 FROM bank_transaction_batches btb
            WHERE btb.raw_record_uuid::text = ru.raw_record_uuid::text
          )
        GROUP BY counteragent_uuid
      )
      SELECT 
        p.id as payment_row_id,
        p.payment_id,
        to_jsonb(p)->>'label' as label,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        p.is_active,
        proj.project_index,
        proj.project_name,
        ca.counteragent as counteragent_formatted,
        ca.name as counteragent_name,
        ca.identification_number as counteragent_id,
        ca.iban as counteragent_iban,
        fc.validation as financial_code_validation,
        fc.code as financial_code,
        fc.description as financial_code_description,
        j.job_name,
        j.weight as job_weight,
        j.floors,
        curr.code as currency_code,
        COALESCE(uc.unbound_count, 0) as unbound_count,
        COALESCE(ledger_agg.total_accrual, 0) as total_accrual,
        COALESCE(ledger_agg.total_order, 0) as total_order,
        COALESCE(bank_agg.total_payment, 0) as total_payment,
        COALESCE(GREATEST(ledger_agg.latest_ledger_date, bank_agg.latest_bank_date), ledger_agg.latest_ledger_date, bank_agg.latest_bank_date) as latest_date
      FROM payments p
      LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
      LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
      LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
      LEFT JOIN unbound_counteragent uc ON p.counteragent_uuid = uc.counteragent_uuid
      LEFT JOIN (
        SELECT 
          payment_id,
          SUM(accrual) as total_accrual,
          SUM("order") as total_order,
          MAX(effective_date) as latest_ledger_date
        FROM payments_ledger
        ${ledgerDateFilter}
        GROUP BY payment_id
      ) ledger_agg ON p.payment_id = ledger_agg.payment_id
      LEFT JOIN (
        SELECT 
          payment_id,
          SUM(nominal_amount) as total_payment,
          MAX(transaction_date::date) as latest_bank_date
        FROM (
          SELECT
            cba.payment_id,
            cba.nominal_amount,
            cba.transaction_date
          FROM raw_union cba
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
            (btb.nominal_amount * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount,
            cba.transaction_date
          FROM raw_union cba
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
      ) bank_agg ON p.payment_id = bank_agg.payment_id
      WHERE p.is_active = true
      ORDER BY p.payment_id DESC
    `;

    const reportData = await prisma.$queryRawUnsafe(query);

    const formattedData = (reportData as any[]).map(row => ({
      paymentId: row.payment_id,
      paymentRowId: row.payment_row_id ? Number(row.payment_row_id) : null,
      label: row.label ?? null,
      counteragentUuid: row.counteragent_uuid,
      projectUuid: row.project_uuid,
      financialCodeUuid: row.financial_code_uuid,
      jobUuid: row.job_uuid,
      currencyUuid: row.currency_uuid,
      isActive: row.is_active,
      counteragent: row.counteragent_formatted || row.counteragent_name,
      counteragentId: row.counteragent_id,
      counteragentIban: row.counteragent_iban,
      project: row.project_index,
      projectName: row.project_name,
      job: row.job_name,
      jobWeight: row.job_weight !== null && row.job_weight !== undefined ? Number(row.job_weight) : null,
      floors: row.floors ? Number(row.floors) : 0,
      financialCode: row.financial_code_validation || row.financial_code,
      financialCodeDescription: row.financial_code_description,
      incomeTax: row.income_tax || false,
      currency: row.currency_code,
      accrual: row.total_accrual ? parseFloat(row.total_accrual) : 0,
      order: row.total_order ? parseFloat(row.total_order) : 0,
      payment: row.total_payment ? parseFloat(row.total_payment) : 0,
      unboundCount: row.unbound_count ? Number(row.unbound_count) : 0,
      hasUnboundCounteragentTransactions: Boolean(row.unbound_count && Number(row.unbound_count) > 0),
      latestDate: row.latest_date || null,
      // Calculated fields
      accrualPerFloor: row.floors && row.total_accrual 
        ? parseFloat((parseFloat(row.total_accrual) / Number(row.floors)).toFixed(2))
        : 0,
      paidPercent: row.total_accrual && parseFloat(row.total_accrual) !== 0
        ? parseFloat(((Math.abs(parseFloat(row.total_payment || 0)) / parseFloat(row.total_accrual)) * 100).toFixed(2))
        : 0,
      due: parseFloat((parseFloat(row.total_order || 0) - Math.abs(parseFloat(row.total_payment || 0))).toFixed(2)),
      balance: parseFloat((parseFloat(row.total_accrual || 0) - Math.abs(parseFloat(row.total_payment || 0))).toFixed(2)),
    }));

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error('Error fetching payments report:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
