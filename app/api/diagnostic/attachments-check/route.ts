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

    return NextResponse.json({
      total,
      active,
      inactive: total - active,
      samples,
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
