import { prisma } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Delete all sessions
    const deleted = await prisma.session.deleteMany({});
    
    return NextResponse.json({
      success: true,
      deletedSessions: deleted.count,
      message: 'All sessions cleared. Try signing in again at https://ice-erp.vercel.app',
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
