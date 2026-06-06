import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

/**
 * GET /api/insider-bank-accounts?insiderUuids=uuid1,uuid2,...
 *
 * Returns bank accounts for the given insider UUIDs.
 * Used by payments-report bank XLSX export to resolve sender account per insider.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUuids = searchParams.get('insiderUuids') || '';

    const uuids = rawUuids
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (uuids.length === 0) {
      return NextResponse.json([]);
    }

    // Validate UUID format to prevent injection
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validUuids = uuids.filter((u) => UUID_RE.test(u));
    if (validUuids.length === 0) {
      return NextResponse.json([]);
    }

    const placeholders = validUuids.map((_, i) => `$${i + 1}::uuid`).join(', ');

    const rows = await prisma.$queryRawUnsafe<
      {
        insider_uuid: string;
        account_number: string;
        bank_name: string | null;
        currency_code: string | null;
        parsing_scheme_name: string | null;
      }[]
    >(
      `
      SELECT
        ba.insider_uuid::text AS insider_uuid,
        ba.account_number,
        b.bank_name,
        c.code AS currency_code,
        ps.scheme AS parsing_scheme_name
      FROM bank_accounts ba
      LEFT JOIN banks b ON ba.bank_uuid = b.uuid
      LEFT JOIN currencies c ON ba.currency_uuid = c.uuid
      LEFT JOIN parsing_schemes ps ON ba.parsing_scheme_uuid = ps.uuid
      WHERE ba.insider_uuid IN (${placeholders})
        AND ba.is_active = TRUE
      ORDER BY ba.created_at ASC
      `,
      ...validUuids
    );

    const accounts = rows.map((row) => ({
      insiderUuid: row.insider_uuid,
      accountNumber: row.account_number,
      bankName: row.bank_name || null,
      currencyCode: row.currency_code || null,
      parsingSchemeName: row.parsing_scheme_name || null,
    }));

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Error fetching insider bank accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch insider bank accounts' }, { status: 500 });
  }
}
