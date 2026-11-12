import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSourceTables } from '@/lib/source-tables';
import { resolveInsiderSelection } from '@/lib/insider-selection';

/**
 * Debug endpoint to diagnose bank account visibility in counteragent statements.
 * Returns: bank account metadata, raw table status, and whether account is discoverable.
 *
 * Query params:
 * - accountNumber: IBAN (optional, defaults to "GE21BG0000000611354669")
 * - showAllAccounts: "true" to show all BOG/TBC accounts (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountNumber = searchParams.get('accountNumber') || 'GE21BG0000000611354669';
    const showAllAccounts = searchParams.get('showAllAccounts') === 'true';

    const { selectedUuids: insiderUuids } = await resolveInsiderSelection(request);

    // Get source tables as they would appear for this user
    const sourceTablesForUser = await getSourceTables(insiderUuids.length > 0 ? insiderUuids : undefined);

    // Query specific account if accountNumber provided
    const targetAccount = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 
        id,
        bank_uuid,
        bank_account_uuid,
        account_number,
        iban,
        insider_uuid,
        currency_uuid,
        raw_table_name,
        is_active,
        created_at,
        updated_at
      FROM bank_accounts 
      WHERE account_number = $1 OR iban = $1
      LIMIT 1`,
      accountNumber
    );

    const account = targetAccount[0] || null;

    let rawTableMetadata: any = null;
    if (account?.raw_table_name) {
      try {
        // Check if table exists and has data
        const tableInfo = await prisma.$queryRawUnsafe<any[]>(
          `SELECT 
            COUNT(*) as row_count,
            COUNT(CASE WHEN payment_id IS NOT NULL THEN 1 END) as rows_with_payment_id
          FROM "${account.raw_table_name}"`
        );
        rawTableMetadata = tableInfo[0] || { row_count: 0, rows_with_payment_id: 0 };
      } catch (err) {
        rawTableMetadata = { error: (err as any).message };
      }
    }

    // Get all BOG/TBC accounts for reference
    let allAccounts: any[] = [];
    if (showAllAccounts) {
      allAccounts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT 
          bank_account_uuid,
          account_number,
          iban,
          bank_uuid,
          insider_uuid,
          currency_uuid,
          raw_table_name,
          is_active
        FROM bank_accounts
        WHERE bank_uuid IN (
          SELECT uuid FROM banks WHERE code IN ('BOG', 'TBC')
        )
        ORDER BY is_active DESC, created_at DESC`
      );
    }

    // Check if account is in the source tables for this user
    const isVisibleToUser = account?.raw_table_name 
      ? sourceTablesForUser.includes(account.raw_table_name)
      : false;

    return NextResponse.json({
      user_email: session.user.email,
      user_selected_insiders: insiderUuids,
      target_account: {
        found: account !== null,
        account_number: account?.account_number || null,
        iban: account?.iban || null,
        is_active: account?.is_active || null,
        raw_table_name: account?.raw_table_name || null,
        insider_uuid: account?.insider_uuid || null,
        currency_uuid: account?.currency_uuid || null,
        visibility_check: {
          in_source_tables_for_user: isVisibleToUser,
          raw_table_exists: account?.raw_table_name ? 'checking...' : 'no table name',
          raw_table_metadata: rawTableMetadata,
        },
      },
      source_tables_for_user: sourceTablesForUser,
      all_bog_tbc_accounts: showAllAccounts ? allAccounts : 'use ?showAllAccounts=true to see',
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as any).message, stack: (error as any).stack },
      { status: 500 }
    );
  }
}
