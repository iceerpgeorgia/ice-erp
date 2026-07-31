import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MarkFollowedUpRequest {
  uuid: string;
  notes: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: MarkFollowedUpRequest = await request.json();
    const { uuid, notes } = body;

    if (!uuid) {
      return NextResponse.json(
        { error: 'Missing UUID' },
        { status: 400 }
      );
    }

    const updated = await prisma.troubleshooting_prompts.update({
      where: { uuid },
      data: {
        is_followed_up: true,
        follow_up_notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      record: updated,
    });
  } catch (error) {
    console.error('Mark followed up error:', error);
    return NextResponse.json(
      { error: 'Failed to update record' },
      { status: 500 }
    );
  }
}
