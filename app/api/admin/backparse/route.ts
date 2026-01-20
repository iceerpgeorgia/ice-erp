import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const maxDuration = 300; // 5 minutes for pro plan
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountUuid, clear } = await request.json();

    if (!accountUuid) {
      return NextResponse.json(
        { error: 'accountUuid is required' },
        { status: 400 }
      );
    }

    // Trigger Python backparse script
    const { spawn } = require('child_process');
    const args = ['import_bank_xml_data.py', 'backparse', '--account-uuid', accountUuid];
    if (clear) {
      args.push('--clear');
    }

    return new Promise((resolve) => {
      const process = spawn('python', args);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        console.log(data.toString());
      });

      process.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        console.error(data.toString());
      });

      process.on('close', (code: number) => {
        if (code === 0) {
          resolve(NextResponse.json({
            success: true,
            message: 'Backparse completed successfully',
            output: stdout
          }));
        } else {
          resolve(NextResponse.json({
            success: false,
            error: 'Backparse failed',
            stdout,
            stderr
          }, { status: 500 }));
        }
      });
    });
  } catch (error) {
    console.error('Backparse error:', error);
    return NextResponse.json(
      { error: 'Failed to run backparse', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
