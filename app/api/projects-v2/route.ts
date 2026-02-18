import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SOURCE_TABLES = [
  "GE78BG0000000893486000_BOG_GEL",
  "GE65TB7856036050100002_TBC_GEL",
];

const UNION_SQL = SOURCE_TABLES.map(
  (table) =>
    `SELECT payment_id, nominal_amount, raw_record_uuid, account_currency_amount FROM "${table}"`
).join(' UNION ALL ');


// GET all projects - FIXED VERSION with project_uuid join
export async function GET(req: NextRequest) {
  try {
    const projects = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id,
        p.created_at,
        p.updated_at,
        p.project_uuid,
        p.counteragent_uuid,
        p.project_name,
        p.financial_code_uuid,
        TO_CHAR(p.date, 'DD.MM.YYYY') as date,
        p.value,
        p.currency_uuid,
        p.state_uuid,
        p.oris_1630,
        p.contract_no,
        p.project_index,
        p.financial_code,
        p.currency,
        p.state,
        p.counteragent,
        '[]'::json as employees,
        COALESCE(pp.total_payment, 0) as total_payments,
        (p.value - COALESCE(pp.total_payment, 0)) as balance
      FROM projects p
      LEFT JOIN (
        SELECT
          p.project_uuid,
          p.counteragent_uuid,
          SUM(ABS(COALESCE(bank_agg.total_payment, 0))) as total_payment
        FROM payments p
        LEFT JOIN (
          SELECT
            payment_id,
            SUM(nominal_amount) as total_payment
          FROM (
            SELECT
              cba.payment_id,
              cba.nominal_amount,
              cba.raw_record_uuid,
              cba.account_currency_amount
            FROM (
              ${UNION_SQL}
            ) cba
            WHERE NOT EXISTS (
              SELECT 1 FROM bank_transaction_batches btb
              WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
            )

            UNION ALL

            SELECT
              btb.payment_id,
              (btb.nominal_amount * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount,
              cba.raw_record_uuid,
              cba.account_currency_amount
            FROM (
              ${UNION_SQL}
            ) cba
            JOIN bank_transaction_batches btb
              ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
          ) combined
          WHERE payment_id IS NOT NULL
          GROUP BY payment_id
        ) bank_agg ON p.payment_id = bank_agg.payment_id
        WHERE p.is_active = true
        GROUP BY p.project_uuid, p.counteragent_uuid
      ) pp ON p.project_uuid = pp.project_uuid AND p.counteragent_uuid = pp.counteragent_uuid
      ORDER BY p.created_at DESC
    `);

    // Convert BigInt to Number for JSON serialization
    const serialized = (projects as any[]).map((project: any) => ({
      ...project,
      id: Number(project.id),
    }));

    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error('GET /projects-v2 error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
