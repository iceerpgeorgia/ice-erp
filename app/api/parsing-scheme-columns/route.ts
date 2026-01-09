import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const schemeUuid = searchParams.get('schemeUuid');

    if (!schemeUuid) {
      return NextResponse.json({ error: 'schemeUuid is required' }, { status: 400 });
    }

    // Get bank accounts that use this parsing scheme and have a raw_table_name
    const bankAccounts = await prisma.$queryRaw<{ raw_table_name: string | null }[]>`
      SELECT raw_table_name 
      FROM bank_accounts 
      WHERE parsing_scheme_uuid = ${schemeUuid}::uuid
        AND raw_table_name IS NOT NULL
      LIMIT 1
    `;

    if (bankAccounts.length === 0 || !bankAccounts[0].raw_table_name) {
      // No bank accounts with raw table mapping yet, return empty
      return NextResponse.json({
        columns: [],
        message: 'No bank accounts with raw data table configured for this scheme'
      });
    }

    const rawTableName = bankAccounts[0].raw_table_name;

    // Get actual columns from the specific raw table
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = ${rawTableName}
        AND table_schema = 'public'
        AND column_name NOT IN (
          'id', 'uuid', 'is_processed', 'import_batch_id', 'created_at', 'updated_at'
        )
      ORDER BY ordinal_position
    `;

    const columnNames = columns.map(col => col.column_name);

    return NextResponse.json({ 
      columns: columnNames,
      rawTableName: rawTableName
    });
  } catch (error) {
    console.error('Error fetching column names:', error);
    return NextResponse.json({ error: 'Failed to fetch column names' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
