import { getServerSession } from "next-auth/next";
import { authOptions, prisma } from "@/lib/auth";

export type AuditAction = "create" | "update" | "delete" | "deactivate" | "activate";

export async function logAudit(params: {
  table: "countries" | "entity_types" | "counteragents" | "financial_codes" | "nbg_exchange_rates" | "currencies" | "projects" | "project_states" | "consolidated_bank_accounts" | "GE78BG0000000893486000_BOG_GEL" | "dimensions" | "inventory_groups" | "inventories" | "rs_waybills_in_items" | "Module" | "ModuleFeature" | "UserPermission";
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
    // Normalize record id for mixed schema environments (record_id can be text or bigint)
    const recordIdStr = typeof params.recordId === 'bigint' 
      ? params.recordId.toString() 
      : typeof params.recordId === 'number'
      ? params.recordId.toString()
      : params.recordId;
    const numericRecordId =
      typeof params.recordId === 'bigint'
        ? params.recordId
        : typeof params.recordId === 'number'
          ? BigInt(params.recordId)
          : /^\d+$/.test(recordIdStr)
            ? BigInt(recordIdStr)
            : null;
    console.log('[DEBUG] Creating auditLog entry:', {
      table: params.table,
      recordId: recordIdStr,
      action: params.action,
      userEmail: email ?? undefined,
      userId: userId ?? undefined,
      changes: params.changes ?? undefined,
    });
    const safeChanges = params.changes === undefined
      ? null
      : JSON.parse(JSON.stringify(params.changes, (_key, value) => {
        if (typeof value === 'bigint') return value.toString();
        if (value && typeof value === 'object' && value.constructor?.name === 'Decimal') {
          return value.toString();
        }
        if (value instanceof Date) return value.toISOString();
        return value;
      }));
    // Use raw SQL to avoid Prisma binary protocol issues with BigInt id + Json? column (22P03).
    // Some environments still have AuditLog.record_id as bigint; retry with bigint cast on type mismatch.
    let result: Array<{ id: bigint }> = [];
    try {
      result = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
        `INSERT INTO "AuditLog" ("table", "record_id", "action", "user_email", "user_id", "changes")
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id`,
        params.table,
        recordIdStr,
        params.action,
        email,
        userId,
        safeChanges ? JSON.stringify(safeChanges) : null
      );
    } catch (insertErr: any) {
      const isBigintTypeMismatch =
        insertErr?.code === 'P2010' &&
        insertErr?.meta?.code === '42804' &&
        String(insertErr?.meta?.message || '').includes('record_id');

      if (!isBigintTypeMismatch) {
        throw insertErr;
      }

      if (numericRecordId === null) {
        // Mixed-schema deployments may keep AuditLog.record_id as bigint while some
        // audit events naturally use composite/text IDs (for example bulk updates).
        result = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
          `INSERT INTO "AuditLog" ("table", "record_id", "action", "user_email", "user_id", "changes")
           VALUES ($1, NULL, $2, $3, $4, $5::jsonb)
           RETURNING id`,
          params.table,
          params.action,
          email,
          userId,
          safeChanges ? JSON.stringify(safeChanges) : null
        );
      } else {
        result = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
          `INSERT INTO "AuditLog" ("table", "record_id", "action", "user_email", "user_id", "changes")
           VALUES ($1, $2::bigint, $3, $4, $5, $6::jsonb)
           RETURNING id`,
          params.table,
          numericRecordId.toString(),
          params.action,
          email,
          userId,
          safeChanges ? JSON.stringify(safeChanges) : null
        );
      }
    }

    console.log('[AUDIT] Audit log created successfully with id:', result[0]?.id);
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

