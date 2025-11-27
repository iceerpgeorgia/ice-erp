import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface AuditLogParams {
  table: string;
  recordId: string | number | bigint | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changes?: Record<string, any>;
}

export async function logAudit(params: AuditLogParams) {
  try {
    const session = await getServerSession(authOptions);
    
    await prisma.auditLog.create({
      data: {
        table: params.table,
        record_id: BigInt(params.recordId),
        action: params.action,
        user_email: session?.user?.email || null,
        user_id: session?.user?.id || null,
        changes: params.changes || undefined,
      },
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
    // Don't throw - audit logging shouldn't break the main operation
  }
}
