import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { permissionCache } from '@/lib/permission-cache';

// POST /api/permissions/modules - Grant all features of a module to a user
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const body = await request.json();

    const { userId, moduleUuid, expiresAt } = body;

    if (!userId || !moduleUuid) {
      return NextResponse.json(
        { error: 'User ID and module UUID are required' },
        { status: 400 }
      );
    }

    // Get module with all its features
    const moduleRecord = await prisma.module.findUnique({
      where: { uuid: moduleUuid },
      include: {
        ModuleFeature: {
          where: { isActive: true },
        },
      },
    });

    if (!moduleRecord) {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      );
    }

    if (!moduleRecord.isActive) {
      return NextResponse.json(
        { error: 'Cannot grant permissions for inactive module' },
        { status: 400 }
      );
    }

    if (moduleRecord.ModuleFeature.length === 0) {
      return NextResponse.json(
        { error: 'Module has no active features to grant' },
        { status: 400 }
      );
    }

    // Grant all features to the user
    const createdPermissions = [];
    const skippedPermissions = [];
    const expirationDate = expiresAt ? new Date(expiresAt) : null;

    for (const feature of moduleRecord.ModuleFeature) {
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
        skippedPermissions.push({
          featureKey: feature.key,
          featureName: feature.name,
          reason: 'already_exists',
        });
        continue;
      }

      const permission = await prisma.userPermission.create({
        data: {
          userId,
          moduleFeatureId: feature.id,
          moduleFeatureUuid: feature.uuid,
          grantedBy: session.user?.id || null,
          expiresAt: expirationDate,
        },
      });

      createdPermissions.push({
        uuid: permission.uuid,
        featureKey: feature.key,
        featureName: feature.name,
      });
    }

    await logAudit({
      table: 'UserPermission',
      recordId: `module:${moduleRecord.uuid}`,
      action: 'create',
      changes: {
        userId,
        moduleUuid,
        moduleKey: moduleRecord.key,
        moduleName: moduleRecord.name,
        featuresGranted: createdPermissions.length,
        featuresSkipped: skippedPermissions.length,
        expiresAt,
      },
    });

    // Invalidate cache for this user
    permissionCache.clearUser(userId);

    return NextResponse.json(
      {
        module: {
          uuid: moduleRecord.uuid,
          name: moduleRecord.name,
          key: moduleRecord.key,
        },
        granted: createdPermissions,
        skipped: skippedPermissions,
        summary: {
          total: moduleRecord.ModuleFeature.length,
          granted: createdPermissions.length,
          skipped: skippedPermissions.length,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error granting module permissions:', error);
    return NextResponse.json(
      { error: 'Failed to grant module permissions' },
      { status: 500 }
    );
  }
}

// DELETE /api/permissions/modules - Revoke all features of a module from a user
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const moduleUuid = searchParams.get('moduleUuid');

    if (!userId || !moduleUuid) {
      return NextResponse.json(
        { error: 'User ID and module UUID are required' },
        { status: 400 }
      );
    }

    // Get module with all its features
    const moduleRecord = await prisma.module.findUnique({
      where: { uuid: moduleUuid },
      include: {
        ModuleFeature: true,
      },
    });

    if (!moduleRecord) {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      );
    }

    const featureIds = moduleRecord.ModuleFeature.map((f) => f.id);

    // Delete all permissions for this module
    const result = await prisma.userPermission.deleteMany({
      where: {
        userId,
        moduleFeatureId: {
          in: featureIds,
        },
      },
    });

    await logAudit({
      table: 'UserPermission',
      recordId: `module:${moduleRecord.uuid}`,
      action: 'delete',
      changes: {
        userId,
        moduleUuid,
        moduleKey: moduleRecord.key,
        moduleName: moduleRecord.name,
        permissionsRevoked: result.count,
      },
    });

    // Invalidate cache for this user
    permissionCache.clearUser(userId);

    return NextResponse.json({
      module: {
        uuid: moduleRecord.uuid,
        name: moduleRecord.name,
        key: moduleRecord.key,
      },
      revoked: result.count,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error revoking module permissions:', error);
    return NextResponse.json(
      { error: 'Failed to revoke module permissions' },
      { status: 500 }
    );
  }
}
