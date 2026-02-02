import { getServerSession } from "next-auth/next";
import { authOptions, prisma } from "@/lib/auth";

export type AuditAction = "create" | "update" | "delete" | "deactivate" | "activate";

export async function logAudit(params: {
  table: "countries" | "entity_types" | "counteragents" | "financial_codes" | "nbg_exchange_rates" | "currencies" | "projects" | "project_states" | "consolidated_bank_accounts" | "GE78BG0000000893486000_BOG_GEL" | "GE65TB7856036050100002_TBC_GEL";
  recordId: bigint | string | number;
  action: AuditAction;
  changes?: any;
}) {
  try {
    console.log('[DEBUG] logAudit called with params:', params);
    console.log('[AUDIT] logAudit called with:', { table: params.table, recordId: typeof params.recordId === 'bigint' ? params.recordId.toString() : params.recordId, action: params.action });
    const session = await getServerSession(authOptions);
    console.log('[AUDIT] Session:', { email: session?.user?.email, userId: (session as any)?.user?.id });
    const email = session?.user?.email ?? null;
    const userId = (session as any)?.user?.id ?? null;
    // Convert recordId to string for storage
    const recordIdStr = typeof params.recordId === 'bigint' 
      ? params.recordId.toString() 
      : typeof params.recordId === 'number'
      ? params.recordId.toString()
      : params.recordId;
    console.log('[DEBUG] Creating auditLog entry:', {
      table: params.table,
      recordId: recordIdStr,
      action: params.action,
      userEmail: email ?? undefined,
      userId: userId ?? undefined,
      changes: params.changes ?? undefined,
    });
    const result = await prisma.auditLog.create({
      data: {
        table: params.table,
        record_id: recordIdStr,
        action: params.action,
        user_email: email ?? undefined,
        user_id: userId ?? undefined,
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
  table: "countries" | "entity_types" | "counteragents" | "financial_codes" | "projects" | "project_states",
  ids: (bigint | string | number)[]
) {
  if (ids.length === 0) return new Map<string, string>();
  
  // Convert all IDs to strings for comparison
  const stringIds = ids.map(id => 
    typeof id === 'bigint' ? id.toString() : 
    typeof id === 'number' ? id.toString() : 
    id
  );
  
  const rows = await prisma.auditLog.findMany({
    where: { table, record_id: { in: stringIds } },
    orderBy: { created_at: "desc" },
    select: { record_id: true, user_email: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    const key = r.record_id;
    if (!map.has(key)) map.set(key, r.user_email ?? "");
  }
  return map;
}

