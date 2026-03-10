import { NextResponse } from 'next/server';
import { getRequiredInsider } from '@/lib/required-insider';

export async function GET() {
  try {
    const insider = await getRequiredInsider();
    return NextResponse.json(insider);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to resolve required insider' }, { status: 500 });
  }
}
