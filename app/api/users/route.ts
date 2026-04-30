import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth';
import { requireAdmin, isAuthError } from '@/lib/auth-guard';
import { createUserSchema, updateUserSchema, formatZodErrors } from '@/lib/api-schemas';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  try {
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
        paymentNotifications: true,
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

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const session = auth;

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: formatZodErrors(parsed.error) }, { status: 400 });
    }
    const { email, name, role } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email,
        name: name || null,
        role,
        isAuthorized: true, // Pre-authorize since admin is creating them
        authorizedAt: new Date(),
        authorizedBy: session.user.email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAuthorized: true,
        authorizedAt: true,
        authorizedBy: true,
        emailVerified: true,
        paymentNotifications: true,
      },
    });

    return NextResponse.json(newUser);
  } catch (error) {
    console.error('[POST /api/users] Error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const session = auth;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: formatZodErrors(parsed.error) }, { status: 400 });
    }
    const { isAuthorized, role, paymentNotifications } = parsed.data;

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

    if (role) {
      updateData.role = role;
    }

    if (typeof paymentNotifications === 'boolean') {
      updateData.paymentNotifications = paymentNotifications;
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
        paymentNotifications: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[PATCH /api/users] Error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const session = auth;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Prevent deleting yourself
    if (session.user.id === userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/users] Error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
