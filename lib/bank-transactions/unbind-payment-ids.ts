import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

/** Raw bank account tables (one per account, e.g. GE78BG..._BOG_GEL) that carry payment bindings. */
async function rawBankTables(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT t.table_name
       FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND (t.table_name LIKE '%\\_BOG\\_%' ESCAPE '\\' OR t.table_name LIKE '%\\_TBC\\_%' ESCAPE '\\')
        AND EXISTS (SELECT 1 FROM information_schema.columns c
                     WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name AND c.column_name = 'payment_id')
        AND EXISTS (SELECT 1 FROM information_schema.columns c
                     WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name AND c.column_name = 'account_currency_amount')
      ORDER BY t.table_name`
  );
  return rows.map((r) => r.table_name);
}

const normalise = (paymentIds: string[]) =>
  Array.from(new Set(paymentIds.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean)));

/** How many bank transactions are bound to these payment IDs (for the confirmation before unbinding). */
export async function countTransactionsByPaymentIds(paymentIds: string[]): Promise<number> {
  const ids = normalise(paymentIds);
  if (ids.length === 0) return 0;
  let total = 0;
  for (const table of await rawBankTables()) {
    const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM "${table}" WHERE lower(btrim(payment_id)) = ANY($1::text[])`,
      ids
    );
    total += rows[0]?.n ?? 0;
  }
  return total;
}

/**
 * Unbind every bank transaction from these payment IDs, the same way a person clearing the payment
 * does: payment ID, project and financial code cleared, nominal back to the account currency, and
 * the parsing lock released so parsing rules may bind the transaction again. Used when the payments
 * are deactivated (bundle payments of a project whose financial code is no longer a bundle).
 * Tables are processed one after another (the local pool may have a single connection).
 */
export async function unbindTransactionsFromPaymentIds(
  paymentIds: string[],
  reason: string
): Promise<{ unbound: number; byTable: Record<string, number> }> {
  const ids = normalise(paymentIds);
  const byTable: Record<string, number> = {};
  let unbound = 0;
  if (ids.length === 0) return { unbound, byTable };

  for (const table of await rawBankTables()) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint; uuid: string; payment_id: string }>>(
      `UPDATE "${table}" t
          SET payment_id            = NULL,
              parsing_lock          = false,
              project_uuid          = NULL,
              financial_code_uuid   = NULL,
              nominal_currency_uuid = account_currency_uuid,
              exchange_rate         = 1,
              nominal_amount        = account_currency_amount,
              updated_at            = NOW()
         FROM (SELECT id, payment_id AS old_payment_id FROM "${table}" WHERE lower(btrim(payment_id)) = ANY($1::text[])) old
        WHERE t.id = old.id
       RETURNING t.id, t.uuid::text AS uuid, old.old_payment_id AS payment_id`,
      ids
    );
    if (rows.length === 0) continue;
    byTable[table] = rows.length;
    unbound += rows.length;
    try {
      await logAudit({
        table: table as any,
        recordId: rows[0].id,
        action: 'update',
        changes: {
          payment_id: 'cleared',
          reason,
          records: rows.map((r) => ({ id: r.id.toString(), uuid: r.uuid, payment_id: r.payment_id })),
        },
      });
    } catch (auditErr) {
      console.warn('[unbind-payment-ids] Audit log failed (non-fatal):', auditErr);
    }
  }
  return { unbound, byTable };
}
