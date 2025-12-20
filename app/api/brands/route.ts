import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    const serialized = (brands as any[]).map((brand: any) => ({
      ...brand,
      id: Number(brand.id),
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
  try {
    const body = await req.json();
    const { name, counteragentUuids } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Brand name is required' },
        { status: 400 }
      );
    }

    const uuids = counteragentUuids || [];

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
  try {
    const body = await req.json();
    const { id, name, counteragentUuids } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Brand ID is required' },
        { status: 400 }
      );
    }

    const uuids = counteragentUuids || [];

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
