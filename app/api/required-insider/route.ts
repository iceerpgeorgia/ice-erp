import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { resolveInsiderSelection } from '@/lib/insider-selection';

export async function GET(request: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(request);
    return NextResponse.json({
      insiderUuid: selection.primaryInsider?.insiderUuid ?? null,
      insiderName: selection.primaryInsider?.insiderName ?? null,
      selectedInsiders: selection.selectedInsiders,
      selectedUuids: selection.selectedUuids,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to resolve required insider' }, { status: 500 });
  }
}
