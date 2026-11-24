import { NextRequest, NextResponse } from 'next/server';
import { runLlmInventoryMatch } from '@/lib/waybills/llm-inventory-match';
import { runUnitMapping } from '@/lib/waybills/llm-unit-mapping';

export const dynamic = 'force-dynamic';
// Up to 150 model calls per run, four at a time.
export const maxDuration = 300;

/**
 * Unit mapping of new RS unit texts, then steps 4-5 of waybill item inventory matching. Runs after the hourly waybill sync and asks
 * Claude to suggest inventories for new items the insert trigger could not match.
 * Suggest only; each item is sent to the model once. `?limit=N` (max 1000) for manual runs.
 */
export async function GET(req: NextRequest) {
  const cronSecret = String(process.env.CRON_SECRET ?? '').trim();
  const authHeader = req.headers.get('authorization');
  const hasVercelCron = req.headers.get('x-vercel-cron') !== null;
  const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
  if (!hasVercelCron && !hasValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limitParam = Number(new URL(req.url).searchParams.get('limit') || 150);
  try {
    // New unit texts first: units Claude maps move their items to a dimension, so those items
    // can be matched in this same run. Admins are emailed about mapped and unmapped units.
    let unitMapping: Awaited<ReturnType<typeof runUnitMapping>> | { error: string };
    try {
      unitMapping = await runUnitMapping();
    } catch (error: any) {
      console.error('[cron/waybill-items-llm-match] unit mapping failed', error);
      unitMapping = { error: error?.message || 'Unit mapping failed' };
    }
    const result = await runLlmInventoryMatch({ limit: Number.isFinite(limitParam) ? limitParam : 150 });
    const status = result.stoppedEarly ? 503 : 200;
    return NextResponse.json({ ...result, unitMapping }, { status });
  } catch (error: any) {
    console.error('[cron/waybill-items-llm-match] failed', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
