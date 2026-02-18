import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Pool } from 'pg';

const ALLOWED_TABLES = new Set([
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
]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ uuid: string }> }
) {
  let pool: Pool | null = null;
  
  try {
    const { uuid } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const sourceTable = searchParams.get('sourceTable');
    const sourceId = searchParams.get('sourceId');
    console.log('Fetching raw record for UUID:', uuid);

    if (sourceTable && ALLOWED_TABLES.has(sourceTable)) {
      const localUrl = process.env.DATABASE_URL;
      if (!localUrl) {
        return NextResponse.json(
          { error: 'Database connection not configured' },
          { status: 500 }
        );
      }

      pool = new Pool({
        connectionString: localUrl,
        max: 1,
      });

      const result = sourceId
        ? await pool.query(
            `SELECT * FROM "${sourceTable}" WHERE id = $1 LIMIT 1`,
            [sourceId]
          )
        : await pool.query(
            `SELECT * FROM "${sourceTable}" WHERE uuid = $1 LIMIT 1`,
            [uuid]
          );

      await pool.end();

      if (result.rows.length > 0) {
        const record = result.rows[0];
        const serializable: Record<string, any> = {};

        for (const [key, value] of Object.entries(record)) {
          serializable[key] = typeof value === 'bigint' ? value.toString() : value;
        }

        return NextResponse.json(serializable);
      }

      return NextResponse.json(
        { error: 'Raw record not found in source table' },
        { status: 404 }
      );
    }

    // Get the consolidated record to find the raw_record_uuid
    const consolidated = await prisma.consolidatedBankAccount.findFirst({
      where: { uuid: uuid },
      select: { rawRecordUuid: true }
    });

    console.log('Consolidated record found:', !!consolidated);
    console.log('Raw record UUID:', consolidated?.rawRecordUuid);

    if (!consolidated?.rawRecordUuid) {
      const localUrl = process.env.DATABASE_URL;
      if (!localUrl) {
        return NextResponse.json(
          { error: 'Database connection not configured' },
          { status: 500 }
        );
      }

      pool = new Pool({
        connectionString: localUrl,
        max: 1
      });

      for (const tableName of ALLOWED_TABLES) {
        const deconsolidated = await pool.query(
          `SELECT * FROM "${tableName}" WHERE uuid = $1 LIMIT 1`,
          [uuid]
        );

        if (deconsolidated.rows.length > 0) {
          const record = deconsolidated.rows[0];
          const serializable: Record<string, any> = {};

          for (const [key, value] of Object.entries(record)) {
            serializable[key] = typeof value === 'bigint' ? value.toString() : value;
          }

          await pool.end();
          return NextResponse.json(serializable);
        }
      }

      await pool.end();

      return NextResponse.json(
        { error: 'Raw record UUID not found for this transaction' },
        { status: 404 }
      );
    }

    // Fetch from LOCAL database where backparse updates the flags
    const localUrl = process.env.DATABASE_URL;
    console.log('Local DB URL configured:', !!localUrl);
    
    if (!localUrl) {
      return NextResponse.json(
        { error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    // Use pg Pool for direct database access
    console.log('Creating pg pool...');
    pool = new Pool({
      connectionString: localUrl,
      max: 1
    });

    console.log('Executing query for raw_record_uuid:', consolidated.rawRecordUuid);
    const result = await pool.query(
      'SELECT * FROM bog_gel_raw_893486000 WHERE uuid = $1 LIMIT 1',
      [consolidated.rawRecordUuid]
    );

    console.log('Query result rows:', result.rows.length);
    await pool.end();

    if (result.rows.length > 0) {
      // Convert BigInt values to strings for JSON serialization
      const record = result.rows[0];
      const serializable: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(record)) {
        serializable[key] = typeof value === 'bigint' ? value.toString() : value;
      }
      
      console.log('Returning serialized record');
      return NextResponse.json(serializable);
    }

    console.log('No records found');
    return NextResponse.json(
      { error: 'Raw record not found in database' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error fetching raw record:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        console.error('Error closing pool:', e);
      }
    }
    return NextResponse.json(
      { error: 'Failed to fetch raw record', details: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
