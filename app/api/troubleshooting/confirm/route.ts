import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ConfirmRequest {
  uuid: string;
  editedPrompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConfirmRequest = await request.json();
    const { uuid, editedPrompt } = body;

    if (!uuid) {
      return NextResponse.json(
        { error: 'Missing UUID' },
        { status: 400 }
      );
    }

    // Update record
    const updated = await prisma.troubleshooting_prompts.update({
      where: { uuid },
      data: {
        edited_prompt: editedPrompt,
        confirmed_by_user: true,
        confirmed_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      record: updated,
    });
  } catch (error) {
    console.error('Confirm troubleshooting error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm prompt' },
      { status: 500 }
    );
  }
}
