import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, prisma } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'system_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAuthorized: true,
        authorizedAt: true,
        authorizedBy: true,
        emailVerified: true,
      },
      orderBy: {
        email: 'asc',
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[GET /api/users] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'system_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { isAuthorized, role } = body;

    const updateData: any = {};

    if (typeof isAuthorized === 'boolean') {
      updateData.isAuthorized = isAuthorized;
      if (isAuthorized) {
        updateData.authorizedAt = new Date();
        updateData.authorizedBy = session.user.email;
      } else {
        updateData.authorizedAt = null;
        updateData.authorizedBy = null;
      }
    }

    if (role && ['user', 'admin', 'system_admin'].includes(role)) {
      updateData.role = role;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAuthorized: true,
        authorizedAt: true,
        authorizedBy: true,
        emailVerified: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[PATCH /api/users] Error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
