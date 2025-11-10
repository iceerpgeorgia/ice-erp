import { getServerSession } from "next-auth/next";
import { authOptions, prisma } from "@/lib/auth";

export type AuditAction = "create" | "update" | "delete" | "deactivate" | "activate";

export async function logAudit(params: {
  table: "countries" | "entity_types" | "counteragents" | "financial_codes";
  recordId: bigint | string;
  action: AuditAction;
  changes?: any;
}) {
  try {
    console.log('[AUDIT] logAudit called with:', { table: params.table, recordId: typeof params.recordId === 'bigint' ? params.recordId.toString() : params.recordId, action: params.action });
    const session = await getServerSession(authOptions);
    console.log('[AUDIT] Session:', { email: session?.user?.email, userId: (session as any)?.user?.id });
    const email = session?.user?.email ?? null;
    const userId = (session as any)?.user?.id ?? null;
    
    // Convert recordId to string for storage
    const recordIdStr = typeof params.recordId === 'bigint' ? params.recordId.toString() : params.recordId;
    
    const result = await prisma.auditLog.create({
      data: {
        table: params.table,
        recordId: recordIdStr,
        action: params.action,
        userEmail: email ?? undefined,
        userId: userId ?? undefined,
        changes: params.changes ?? undefined,
      },
      select: { id: true },
    });
    console.log('[AUDIT] Audit log created successfully with id:', result.id);
  } catch (err) {
    console.error("[audit] failed to write audit log", err);
  }
}

export async function loadLatestEditors(
  table: "countries" | "entity_types" | "counteragents" | "financial_codes",
  ids: (bigint | string)[]
) {
  if (ids.length === 0) return new Map<string, string>();
  
  // Convert all IDs to strings for comparison
  const stringIds = ids.map(id => typeof id === 'bigint' ? id.toString() : id);
  
  const rows = await prisma.auditLog.findMany({
    where: { table, recordId: { in: stringIds } },
    orderBy: { createdAt: "desc" },
    select: { recordId: true, userEmail: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    const key = r.recordId;
    if (!map.has(key)) map.set(key, r.userEmail ?? "");
  }
  return map;
}

