import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

export async function GET() {
  try {
    // Simple count query
    const total = await prisma.attachments.count();
    const active = await prisma.attachments.count({ where: { is_active: true } });
    
    // Get sample records
    const samples = await prisma.attachments.findMany({
      take: 5,
      select: {
        id: true,
        uuid: true,
        file_name: true,
        is_active: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // Convert BigInt to Number for JSON serialization
    const serializedSamples = samples.map(s => ({
      id: Number(s.id),
      uuid: s.uuid,
      file_name: s.file_name,
      is_active: s.is_active,
      created_at: s.created_at,
    }));

    return NextResponse.json({
      total,
      active,
      inactive: total - active,
      samples: serializedSamples,
      databaseUrl: process.env.DATABASE_URL?.substring(0, 50) + '...', // Partial for security
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
