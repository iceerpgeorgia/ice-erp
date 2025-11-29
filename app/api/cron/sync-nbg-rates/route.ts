import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[NBG Sync] Starting NBG exchange rates sync...');
    
    // Run the Python script
    const { stdout, stderr } = await execAsync('python scripts/update-nbg-rates.py', {
      env: { ...process.env },
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    console.log('[NBG Sync] Script output:', stdout);
    if (stderr) console.error('[NBG Sync] Script errors:', stderr);

    return NextResponse.json({
      success: true,
      message: 'NBG rates synced successfully',
      output: stdout,
    });
  } catch (error: any) {
    console.error('[NBG Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stderr: error.stderr,
      },
      { status: 500 }
    );
  }
}
