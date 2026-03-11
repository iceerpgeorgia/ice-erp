import { NextRequest, NextResponse } from 'next/server';
import {
  INSIDER_SELECTION_COOKIE,
  getInsiderOptions,
  resolveInsiderSelection,
  serializeInsiderSelectionCookie,
} from '@/lib/insider-selection';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(request);

    return NextResponse.json({
      options: selection.options,
      selectedUuids: selection.selectedUuids,
      selectedInsiders: selection.selectedInsiders,
      primaryInsider: selection.primaryInsider,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to resolve insider selection' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const selectedUuids = Array.isArray(body?.selectedUuids)
      ? body.selectedUuids.map((value: unknown) => String(value))
      : [];

    const options = await getInsiderOptions();
    const optionSet = new Set(options.map((option) => option.insiderUuid.toLowerCase()));
    const validSelected = selectedUuids.filter((uuid: string) => optionSet.has(uuid.toLowerCase()));

    const effectiveSelection = validSelected.length > 0
      ? validSelected
      : options.map((option) => option.insiderUuid);

    const response = NextResponse.json({
      success: true,
      selectedUuids: effectiveSelection,
    });

    response.cookies.set({
      name: INSIDER_SELECTION_COOKIE,
      value: serializeInsiderSelectionCookie(effectiveSelection),
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 180,
      httpOnly: false,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to save insider selection' },
      { status: 500 }
    );
  }
}
