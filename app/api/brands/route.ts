import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { BrandType } from '@/types/brand';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { createBrandSchema, updateBrandSchema, formatZodErrors } from '@/lib/api-schemas';

// GET all brands
export async function GET(req: NextRequest) {
  try {
    const brands = await prisma.$queryRaw`
      SELECT 
        id,
        uuid,
        name,
        counteragent_uuids,
        is_active,
        created_at,
        updated_at
      FROM brands
      WHERE is_active = true
      ORDER BY name ASC
    `;

    const serialized: BrandType[] = (brands as any[]).map((brand: any) => ({
      id: Number(brand.id),
      uuid: brand.uuid,
      name: brand.name,
    }));

    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error('GET /api/brands error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}

// POST - Create new brand
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const body = await req.json();
    const parsed = createBrandSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }
    const { name, counteragentUuids: uuids } = parsed.data;

    const result = await prisma.$queryRaw`
      INSERT INTO brands (name, counteragent_uuids)
      VALUES (${name}, ${uuids}::uuid[])
      RETURNING id, uuid
    ` as any[];

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('POST /api/brands error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create brand' },
      { status: 500 }
    );
  }
}

// PUT - Update brand
export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const body = await req.json();
    const parsed = updateBrandSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }
    const { id, name, counteragentUuids: uuids } = parsed.data;

    await prisma.$queryRaw`
      UPDATE brands
      SET 
        name = ${name},
        counteragent_uuids = ${uuids}::uuid[],
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PUT /api/brands error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update brand' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete brand
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Brand ID is required' },
        { status: 400 }
      );
    }

    await prisma.$queryRaw`
      UPDATE brands
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/brands error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete brand' },
      { status: 500 }
    );
  }
}
