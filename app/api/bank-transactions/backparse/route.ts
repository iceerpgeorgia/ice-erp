import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clear, accountUuid, batchId } = body;

    // Build command
    let command = 'python import_bank_xml_data.py backparse';
    
    if (clear) command += ' --clear';
    if (accountUuid) command += ` --account-uuid ${accountUuid}`;
    if (batchId) command += ` --batch-id ${batchId}`;

    console.log('🚀 Running backparse command:', command);

    // Execute with timeout of 10 minutes
    const { stdout, stderr } = await execAsync(command, {
      timeout: 600000,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return NextResponse.json({
      success: true,
      stdout,
      stderr,
      message: 'Backparse completed successfully',
    });
  } catch (error: any) {
    console.error('❌ Backparse error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
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
