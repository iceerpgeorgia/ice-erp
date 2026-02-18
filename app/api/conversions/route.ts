import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = `
      SELECT
        c.id,
        c.uuid,
        c.date,
        c.key_value,
        c.bank_uuid,
        c.account_out_uuid,
        ao.account_number AS account_out_number,
        c.currency_out_uuid,
        co.code AS currency_out_code,
        c.amount_out,
        c.account_in_uuid,
        ai.account_number AS account_in_number,
        c.currency_in_uuid,
        ci.code AS currency_in_code,
        c.amount_in,
        c.fee,
        b.bank_name,
        c.created_at,
        c.updated_at
      FROM conversion c
      LEFT JOIN bank_accounts ao ON c.account_out_uuid = ao.uuid
      LEFT JOIN bank_accounts ai ON c.account_in_uuid = ai.uuid
      LEFT JOIN banks b ON c.bank_uuid = b.uuid
      LEFT JOIN currencies co ON c.currency_out_uuid = co.uuid
      LEFT JOIN currencies ci ON c.currency_in_uuid = ci.uuid
      ORDER BY c.date DESC, c.id DESC
    `;
    let rows: any[] = [];
    try {
      rows = await prisma.$queryRawUnsafe(query);
    } catch (queryError) {
      console.warn('Conversions query failed, falling back without bank_uuid:', queryError);
      const fallbackQuery = `
        SELECT
          c.id,
          c.uuid,
          c.date,
          c.key_value,
          c.account_out_uuid,
          ao.account_number AS account_out_number,
          c.currency_out_uuid,
          co.code AS currency_out_code,
          c.amount_out,
          c.account_in_uuid,
          ai.account_number AS account_in_number,
          c.currency_in_uuid,
          ci.code AS currency_in_code,
          c.amount_in,
          c.fee,
          c.created_at,
          c.updated_at
        FROM conversion c
        LEFT JOIN bank_accounts ao ON c.account_out_uuid = ao.uuid
        LEFT JOIN bank_accounts ai ON c.account_in_uuid = ai.uuid
        LEFT JOIN currencies co ON c.currency_out_uuid = co.uuid
        LEFT JOIN currencies ci ON c.currency_in_uuid = ci.uuid
        ORDER BY c.date DESC, c.id DESC
      `;
      rows = await prisma.$queryRawUnsafe(fallbackQuery);
    }

    const formatted = (rows as any[]).map((row) => ({
      id: row.id ? Number(row.id) : 0,
      uuid: row.uuid,
      date: row.date ? String(row.date) : null,
      keyValue: row.key_value,
      bankUuid: row.bank_uuid || null,
      bankName: row.bank_name || null,
      accountOutUuid: row.account_out_uuid,
      accountOutNumber: row.account_out_number || null,
      currencyOutUuid: row.currency_out_uuid,
      currencyOutCode: row.currency_out_code || null,
      amountOut: row.amount_out ? Number(row.amount_out) : 0,
      accountInUuid: row.account_in_uuid,
      accountInNumber: row.account_in_number || null,
      currencyInUuid: row.currency_in_uuid,
      currencyInCode: row.currency_in_code || null,
      amountIn: row.amount_in ? Number(row.amount_in) : 0,
      fee: row.fee !== null && row.fee !== undefined ? Number(row.fee) : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching conversions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
