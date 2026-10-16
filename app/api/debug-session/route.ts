import { getServerSession } from 'next-auth';
import { authOptions, prisma } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-guard';

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  try {
    const session = await getServerSession(authOptions);
    
    // Get all sessions from database
    const allSessions = await prisma.session.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isAuthorized: true,
          }
        }
      }
    });

    // Get all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isAuthorized: true,
        authorizedAt: true,
      }
    });

    return NextResponse.json({
      currentSession: session,
      allSessions: allSessions,
      allUsers: allUsers,
      env: {
        hasAuthorizedEmails: !!process.env.AUTHORIZED_EMAILS,
        authorizedEmails: process.env.AUTHORIZED_EMAILS?.split(','),
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
