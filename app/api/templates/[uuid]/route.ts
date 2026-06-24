import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';

const prisma = new PrismaClient();

/**
 * PATCH /api/templates/:uuid
 * Activate/deactivate a template
 */
export async function PATCH(
  req: NextRequest,
  context: { params: { uuid: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { uuid } = context.params;
    const body = await req.json();
    const { is_active } = body;

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: 'is_active must be a boolean' },
        { status: 400 }
      );
    }

    const template = await prisma.templates.findUnique({
      where: { uuid },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // If activating, deactivate all others for this operation_type
    if (is_active && !template.is_active) {
      await prisma.templates.updateMany({
        where: {
          operation_type: template.operation_type,
          is_active: true,
        },
        data: {
          is_active: false,
          archived_at: new Date(),
        },
      });
    }

    const updated = await prisma.templates.update({
      where: { uuid },
      data: {
        is_active,
        archived_at: !is_active ? new Date() : null,
        updated_at: new Date(),
      },
      select: {
        uuid: true,
        operation_type: true,
        file_name: true,
        file_size_bytes: true,
        is_active: true,
        archived_at: true,
        created_at: true,
      },
    });

    console.log('[PATCH /api/templates/:uuid] Updated template:', uuid, 'is_active:', is_active);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/templates/:uuid] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/:uuid
 * Archive a template
 */
export async function DELETE(
  req: NextRequest,
  context: { params: { uuid: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { uuid } = context.params;

    const template = await prisma.templates.findUnique({
      where: { uuid },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of only active template
    if (template.is_active) {
      const activeCount = await prisma.templates.count({
        where: {
          operation_type: template.operation_type,
          is_active: true,
        },
      });

      if (activeCount === 1) {
        return NextResponse.json(
          { error: 'Cannot delete the only active template for this operation type. Please activate another template first.' },
          { status: 400 }
        );
      }
    }

    const deleted = await prisma.templates.update({
      where: { uuid },
      data: {
        is_active: false,
        archived_at: new Date(),
        updated_at: new Date(),
      },
      select: {
        uuid: true,
        operation_type: true,
      },
    });

    console.log('[DELETE /api/templates/:uuid] Archived template:', uuid);

    return NextResponse.json({
      message: 'Template archived successfully',
      template: deleted,
    });
  } catch (error) {
    console.error('[DELETE /api/templates/:uuid] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}

