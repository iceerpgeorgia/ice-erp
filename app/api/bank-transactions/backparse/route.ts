import { NextRequest, NextResponse } from 'next/server';
import { backparseExistingData } from '@/lib/bank-import/import_bank_xml_data';

/**
 * Backparse API - Reprocess existing raw data without XML upload
 * Applies current parsing rules, counteragent mappings, and payment data
 * to existing raw bank statement records
 */
export async function POST(request: NextRequest) {
  let allLogs = "";

  // Capture console.log output
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    allLogs += message + '\n';
    originalLog(...args);
  };

  try {
    const body = await request.json();
    const { clear, accountUuid, batchId } = body;

    console.log('🔄 BACKPARSE REQUEST');
    console.log('━'.repeat(80));
    if (accountUuid) console.log(`Account UUID: ${accountUuid}`);
    if (batchId) console.log(`Batch ID: ${batchId}`);
    if (clear) console.log(`Clear Consolidated: ${clear}`);
    console.log('━'.repeat(80) + '\n');

    // Run TypeScript backparse
    await backparseExistingData(accountUuid, batchId, clear);

    console.log = originalLog;

    return NextResponse.json({
      success: true,
      message: 'Backparse completed successfully',
      logs: allLogs,
    });
  } catch (error: any) {
    console.log = originalLog;
    console.error('❌ Backparse error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        logs: allLogs,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/bank-transactions/backparse',
    method: 'POST',
    description: 'Trigger backparse operation for BOG GEL bank statements',
    body: {
      clear: 'boolean (optional) - Clear consolidated data before reparse',
      accountUuid: 'string (optional) - Process specific account only',
      batchId: 'string (optional) - Process specific batch only',
    },
    example: {
      clear: true,
    },
  });
}
