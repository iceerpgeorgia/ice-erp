import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const DECONSOLIDATED_TABLE = 'GE78BG0000000893486000_BOG_GEL';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const counteragentUuid = searchParams.get('counteragentUuid');

    if (!counteragentUuid) {
      return NextResponse.json({ error: 'Counteragent UUID is required' }, { status: 400 });
    }

    const counteragentRows = await prisma.$queryRawUnsafe<
      Array<{ counteragent_uuid: string; counteragent_name: string | null; counteragent_id: string | null }>
    >(
      `SELECT counteragent_uuid, counteragent as counteragent_name, identification_number as counteragent_id
       FROM counteragents
       WHERE counteragent_uuid = $1
       LIMIT 1`,
      counteragentUuid
    );

    const counteragent = counteragentRows[0] ?? null;

    const paymentRows = await prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
      `SELECT payment_id
       FROM payments
       WHERE counteragent_uuid = $1 AND is_active = true`,
      counteragentUuid
    );

    const paymentIds = paymentRows.map((row) => row.payment_id);

    const ledgerEntries = paymentIds.length
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT
             id,
             payment_id,
             effective_date,
             accrual,
             "order",
             comment,
             user_email,
             created_at
           FROM payments_ledger
           WHERE payment_id = ANY($1::text[])
             AND (is_deleted = false OR is_deleted IS NULL)
           ORDER BY effective_date DESC`,
          paymentIds
        )
      : [];

    const bankTransactions = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         cba.id,
         cba.uuid,
         cba.payment_id,
         cba.account_currency_amount,
         cba.nominal_amount,
         cba.transaction_date,
         cba.counteragent_account_number,
         cba.description,
         cba.created_at,
         ba.account_number as bank_account_number,
         curr.code as account_currency_code
       FROM "${DECONSOLIDATED_TABLE}" cba
       LEFT JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
       LEFT JOIN currencies curr ON cba.account_currency_uuid = curr.uuid
       WHERE cba.counteragent_uuid = $1
       ORDER BY cba.transaction_date DESC`,
      counteragentUuid
    );

    return NextResponse.json({
      counteragent,
      paymentIds,
      ledgerEntries: ledgerEntries.map((entry) => ({
        id: Number(entry.id),
        paymentId: entry.payment_id,
        effectiveDate: entry.effective_date,
        accrual: entry.accrual ? parseFloat(entry.accrual) : 0,
        order: entry.order ? parseFloat(entry.order) : 0,
        comment: entry.comment,
        userEmail: entry.user_email,
        createdAt: entry.created_at,
      })),
      bankTransactions: bankTransactions.map((tx) => ({
        id: Number(tx.id),
        uuid: tx.uuid,
        paymentId: tx.payment_id,
        accountCurrencyAmount: tx.account_currency_amount ? parseFloat(tx.account_currency_amount) : 0,
        nominalAmount: tx.nominal_amount ? parseFloat(tx.nominal_amount) : 0,
        date: tx.transaction_date,
        counteragentAccountNumber: tx.counteragent_account_number,
        description: tx.description,
        createdAt: tx.created_at,
        accountLabel: `${tx.bank_account_number || ''} ${tx.account_currency_code || ''}`.trim() || '-',
      })),
    });
  } catch (error: any) {
    console.error('Error fetching counteragent statement:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
