import { getServerSession } from "next-auth/next";
import { authOptions, prisma } from "@/lib/auth";

export type AuditAction = "create" | "update" | "delete" | "deactivate" | "activate";

export async function logAudit(params: {
  table: "countries" | "entity_types" | "counteragents";
  recordId: bigint;
  action: AuditAction;
  changes?: any;
}) {
  try {
    console.log('[AUDIT] logAudit called with:', { table: params.table, recordId: params.recordId.toString(), action: params.action });
    const session = await getServerSession(authOptions);
    console.log('[AUDIT] Session:', { email: session?.user?.email, userId: (session as any)?.user?.id });
    const email = session?.user?.email ?? null;
    const userId = (session as any)?.user?.id ?? null;
    const result = await prisma.auditLog.create({
      data: {
        table: params.table,
        recordId: params.recordId,
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
  table: "countries" | "entity_types" | "counteragents",
  ids: bigint[]
) {
  if (ids.length === 0) return new Map<number, string>();
  const rows = await prisma.auditLog.findMany({
    where: { table, recordId: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: { recordId: true, userEmail: true },
  });
  const map = new Map<number, string>();
  for (const r of rows) {
    const key = Number(r.recordId);
    if (!map.has(key)) map.set(key, r.userEmail ?? "");
  }
  return map;
}

