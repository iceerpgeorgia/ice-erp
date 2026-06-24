import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';

const prisma = new PrismaClient();

export const runtime = 'nodejs';

/**
 * GET /api/templates?operationType=handover
 * List templates, optionally filtered by operation_type
 * Returns: array of template records with is_active status
 */
export async function GET(req: NextRequest) {
  try {
    const operationType = req.nextUrl.searchParams.get('operationType');

    const where: any = {};
    if (operationType) {
      where.operation_type = operationType;
    }

    const templates = await prisma.templates.findMany({
      where,
      select: {
        uuid: true,
        operation_type: true,
        file_name: true,
        file_size_bytes: true,
        is_active: true,
        archived_at: true,
        created_at: true,
        created_by_user_id: true,
      },
      orderBy: [{ operation_type: 'asc' }, { created_at: 'desc' }],
    });

    // Convert BigInt to Number for JSON serialization
    const serialized = templates.map(t => ({
      ...t,
      file_size_bytes: Number(t.file_size_bytes),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('[GET /api/templates] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Upload a new template file
 * 
 * Body:
 * - operationType: "handover", "invoice", etc.
 * - file: File object (multipart)
 * - activate: boolean (set as active template?)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const operationType = formData.get('operationType') as string;
    const shouldActivate = formData.get('activate') === 'true';
    const file = formData.get('file') as File;

    if (!operationType || !file) {
      return NextResponse.json(
        { error: 'Missing operationType or file' },
        { status: 400 }
      );
    }

    // For now, we'll assume the file is handled via a separate file upload service
    // In production, you'd integrate with Supabase storage or similar
    // For this implementation, we'll return placeholder data that the admin page will complete

    const templateData = {
      operation_type: operationType,
      file_name: file.name,
      storage_provider: 'supabase',
      storage_bucket: 'templates',
      storage_path: `templates/${operationType}/${Date.now()}-${file.name}`,
      file_size_bytes: file.size,
      is_active: shouldActivate,
      created_by_user_id: session.user.email,
    };

    // If activating, deactivate all existing templates for this operation_type
    if (shouldActivate) {
      await prisma.templates.updateMany({
        where: {
          operation_type: operationType,
          is_active: true,
        },
        data: {
          is_active: false,
          archived_at: new Date(),
        },
      });
    }

    // Create the new template record
    const template = await prisma.templates.create({
      data: templateData,
      select: {
        uuid: true,
        operation_type: true,
        file_name: true,
        file_size_bytes: true,
        is_active: true,
        created_at: true,
      },
    });

    console.log('[POST /api/templates] Created template:', template.uuid, 'for operation:', operationType);

    // Convert BigInt to Number for JSON serialization
    return NextResponse.json({
      ...template,
      file_size_bytes: Number(template.file_size_bytes),
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/templates] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
