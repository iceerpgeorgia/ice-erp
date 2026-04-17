import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { permissionCache } from '@/lib/permission-cache';

// GET /api/module-features?moduleUuid=xxx - List features for a module (or all features)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const { searchParams } = new URL(request.url);
    const moduleUuid = searchParams.get('moduleUuid');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const features = await prisma.moduleFeature.findMany({
      where: {
        ...(moduleUuid && { moduleUuid }),
        ...(activeOnly && { isActive: true }),
      },
      include: {
        module: true,
      },
      orderBy: [{ moduleId: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(features);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching module features:', error);
    return NextResponse.json(
      { error: 'Failed to fetch module features' },
      { status: 500 }
    );
  }
}

// POST /api/module-features - Create new feature for a module
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const body = await request.json();

    const {
      moduleUuid,
      name,
      key,
      description,
      featureType = 'action',
      isActive = true,
    } = body;

    if (!moduleUuid || !name || !key) {
      return NextResponse.json(
        { error: 'Module UUID, name, and key are required' },
        { status: 400 }
      );
    }

    // Get module to find moduleId
    const moduleRecord = await prisma.module.findUnique({
      where: { uuid: moduleUuid },
    });

    if (!moduleRecord) {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      );
    }

    // Check if key already exists for this module
    const existing = await prisma.moduleFeature.findFirst({
      where: {
        moduleId: moduleRecord.id,
        key,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Feature with this key already exists for this module' },
        { status: 409 }
      );
    }

    const feature = await prisma.moduleFeature.create({
      data: {
        moduleId: moduleRecord.id,
        moduleUuid,
        name,
        key,
        description,
        featureType,
        isActive,
      },
      include: {
        module: true,
      },
    });

    await logAudit({
      table: 'ModuleFeature',
      recordId: feature.uuid,
      action: 'create',
      changes: body,
    });

    // Invalidate cache for this module
    permissionCache.clearModule(feature.module.key);

    return NextResponse.json(feature, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error creating module feature:', error);
    return NextResponse.json(
      { error: 'Failed to create module feature' },
      { status: 500 }
    );
  }
}

// PATCH /api/module-features?uuid=xxx - Update feature
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (!uuid) {
      return NextResponse.json(
        { error: 'Feature UUID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, key, description, featureType, isActive } = body;

    // If changing key, check uniqueness within module
    if (key) {
      const currentFeature = await prisma.moduleFeature.findUnique({
        where: { uuid },
      });

      if (currentFeature) {
        const existing = await prisma.moduleFeature.findFirst({
          where: {
            moduleId: currentFeature.moduleId,
            key,
            NOT: { uuid },
          },
        });

        if (existing) {
          return NextResponse.json(
            { error: 'Feature with this key already exists for this module' },
            { status: 409 }
          );
        }
      }
    }

    const feature = await prisma.moduleFeature.update({
      where: { uuid },
      data: {
        ...(name !== undefined && { name }),
        ...(key !== undefined && { key }),
        ...(description !== undefined && { description }),
        ...(featureType !== undefined && { featureType }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        module: true,
      },
    });

    await logAudit({
      table: 'ModuleFeature',
      recordId: uuid,
      action: 'update',
      changes: body,
    });

    // Invalidate cache for this module
    permissionCache.clearModule(feature.module.key);

    return NextResponse.json(feature);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error updating module feature:', error);
    return NextResponse.json(
      { error: 'Failed to update module feature' },
      { status: 500 }
    );
  }
}

// DELETE /api/module-features?uuid=xxx - Delete feature
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (!uuid) {
      return NextResponse.json(
        { error: 'Feature UUID is required' },
        { status: 400 }
      );
    }

    // Get feature with module info before deleting for cache invalidation
    const feature = await prisma.moduleFeature.findUnique({
      where: { uuid },
      include: { module: true },
    });

    if (!feature) {
      return NextResponse.json(
        { error: 'Feature not found' },
        { status: 404 }
      );
    }

    await prisma.moduleFeature.delete({
      where: { uuid },
    });

    await logAudit({
      table: 'ModuleFeature',
      recordId: uuid,
      action: 'delete',
      changes: null,
    });

    // Invalidate cache for this module
    permissionCache.clearModule(feature.module.key);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error deleting module feature:', error);
    return NextResponse.json(
      { error: 'Failed to delete module feature' },
      { status: 500 }
    );
  }
}
