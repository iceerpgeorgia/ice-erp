import { prisma } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-guard';

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  try {
    // Delete all sessions
    const deleted = await prisma.session.deleteMany({});

    return NextResponse.json({
      success: true,
      deletedSessions: deleted.count,
      message: 'All sessions cleared. Try signing in again.',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
