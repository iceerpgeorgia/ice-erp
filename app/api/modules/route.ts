import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { permissionCache } from '@/lib/permission-cache';

// GET /api/modules - List all modules
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const modules = await prisma.module.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: {
        ModuleFeature: {
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(modules);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching modules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch modules' },
      { status: 500 }
    );
  }
}

// POST /api/modules - Create new module
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const body = await request.json();

    const {
      name,
      key,
      description,
      icon,
      route,
      displayOrder = 0,
      isActive = true,
    } = body;

    if (!name || !key) {
      return NextResponse.json(
        { error: 'Name and key are required' },
        { status: 400 }
      );
    }

    // Check if key already exists
    const existing = await prisma.module.findUnique({
      where: { key },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Module with this key already exists' },
        { status: 409 }
      );
    }

    const moduleRecord = await prisma.module.create({
      data: {
        name,
        key,
        description,
        icon,
        route,
        displayOrder,
        isActive,
      },
    });

    await logAudit({
      table: 'Module',
      recordId: moduleRecord.uuid,
      action: 'create',
      changes: body,
    });

    return NextResponse.json(module, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error creating module:', error);
    return NextResponse.json(
      { error: 'Failed to create module' },
      { status: 500 }
    );
  }
}

// PATCH /api/modules?uuid=xxx - Update module
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (!uuid) {
      return NextResponse.json(
        { error: 'Module UUID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, key, description, icon, route, displayOrder, isActive } =
      body;

    // If changing key, check uniqueness
    if (key) {
      const existing = await prisma.module.findFirst({
        where: {
          key,
          NOT: { uuid },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Module with this key already exists' },
          { status: 409 }
        );
      }
    }

    const moduleRecord = await prisma.module.update({
      where: { uuid },
      data: {
        ...(name !== undefined && { name }),
        ...(key !== undefined && { key }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(route !== undefined && { route }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await logAudit({
      table: 'Module',
      recordId: uuid,
      action: 'update',
      changes: body,
    });

    // Invalidate cache for this module (affects all users with this module)
    permissionCache.clearModule(moduleRecord.key);

    return NextResponse.json(moduleRecord);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error updating module:', error);
    return NextResponse.json(
      { error: 'Failed to update module' },
      { status: 500 }
    );
  }
}

// DELETE /api/modules?uuid=xxx - Delete module (cascade deletes features)
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (!uuid) {
      return NextResponse.json(
        { error: 'Module UUID is required' },
        { status: 400 }
      );
    }

    // Get module key before deleting for cache invalidation
    const moduleRecord = await prisma.module.findUnique({
      where: { uuid },
      select: { key: true },
    });

    if (!moduleRecord) {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      );
    }

    await prisma.module.delete({
      where: { uuid },
    });

    await logAudit({
      table: 'Module',
      recordId: uuid,
      action: 'delete',
      changes: null,
    });

    // Invalidate cache for this module
    permissionCache.clearModule(moduleRecord.key);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error deleting module:', error);
    return NextResponse.json(
      { error: 'Failed to delete module' },
      { status: 500 }
    );
  }
}
