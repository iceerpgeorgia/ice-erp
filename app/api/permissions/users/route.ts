import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { permissionCache } from '@/lib/permission-cache';

// GET /api/permissions/users?userId=xxx - Get user permissions (or all if no userId)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const permissions = await prisma.userPermission.findMany({
      where: userId ? { userId } : undefined,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        moduleFeature: {
          include: {
            module: true,
          },
        },
      },
      orderBy: [
        { userId: 'asc' },
        { moduleFeature: { module: { displayOrder: 'asc' } } },
      ],
    });

    return NextResponse.json(permissions);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching user permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user permissions' },
      { status: 500 }
    );
  }
}

// POST /api/permissions/users - Grant permission to user
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const body = await request.json();

    const { userId, moduleFeatureUuid, expiresAt } = body;

    if (!userId || !moduleFeatureUuid) {
      return NextResponse.json(
        { error: 'User ID and module feature UUID are required' },
        { status: 400 }
      );
    }

    // Get feature to find moduleFeatureId
    const feature = await prisma.moduleFeature.findUnique({
      where: { uuid: moduleFeatureUuid },
    });

    if (!feature) {
      return NextResponse.json(
        { error: 'Module feature not found' },
        { status: 404 }
      );
    }

    // Check if permission already exists
    const existing = await prisma.userPermission.findUnique({
      where: {
        userId_moduleFeatureId: {
          userId,
          moduleFeatureId: feature.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Permission already granted to this user' },
        { status: 409 }
      );
    }

    const permission = await prisma.userPermission.create({
      data: {
        userId,
        moduleFeatureId: feature.id,
        moduleFeatureUuid,
        grantedBy: session.user?.id || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        moduleFeature: {
          include: {
            module: true,
          },
        },
      },
    });

    await logAudit({
      table: 'UserPermission',
      recordId: permission.uuid,
      action: 'create',
      changes: { userId, moduleFeatureUuid, expiresAt },
    });

    // Invalidate cache for this user
    permissionCache.clearUser(userId);

    return NextResponse.json(permission, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error creating user permission:', error);
    return NextResponse.json(
      { error: 'Failed to create user permission' },
      { status: 500 }
    );
  }
}

// DELETE /api/permissions/users?uuid=xxx - Revoke permission
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (!uuid) {
      return NextResponse.json(
        { error: 'Permission UUID is required' },
        { status: 400 }
      );
    }

    // Get permission to retrieve userId before deleting
    const permission = await prisma.userPermission.findUnique({
      where: { uuid },
      select: { userId: true },
    });

    if (!permission) {
      return NextResponse.json(
        { error: 'Permission not found' },
        { status: 404 }
      );
    }

    await prisma.userPermission.delete({
      where: { uuid },
    });

    await logAudit({
      table: 'UserPermission',
      recordId: uuid,
      action: 'delete',
      changes: null,
    });

    // Invalidate cache for this user
    permissionCache.clearUser(permission.userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error deleting user permission:', error);
    return NextResponse.json(
      { error: 'Failed to delete user permission' },
      { status: 500 }
    );
  }
}

// PATCH /api/permissions/users - Bulk update user permissions
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const body = await request.json();

    const { userId, permissions } = body;

    if (!userId || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'User ID and permissions array are required' },
        { status: 400 }
      );
    }

    // Delete all existing permissions for this user
    await prisma.userPermission.deleteMany({
      where: { userId },
    });

    // Create new permissions
    const createdPermissions = [];
    for (const permUuid of permissions) {
      const feature = await prisma.moduleFeature.findUnique({
        where: { uuid: permUuid },
      });

      if (feature) {
        const perm = await prisma.userPermission.create({
          data: {
            userId,
            moduleFeatureId: feature.id,
            moduleFeatureUuid: permUuid,
            grantedBy: session.user?.id || null,
          },
        });
        createdPermissions.push(perm);
      }
    }

    await logAudit({
      table: 'UserPermission',
      recordId: userId,
      action: 'update',
      changes: { permissions },
    });

    // Invalidate cache for this user
    permissionCache.clearUser(userId);

    return NextResponse.json({ count: createdPermissions.length });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error updating user permissions:', error);
    return NextResponse.json(
      { error: 'Failed to update user permissions' },
      { status: 500 }
    );
  }
}
