import { prisma } from '@/lib/prisma';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns the list of all deconsolidated raw bank table names configured
 * in the bank_accounts table. This replaces hardcoded SOURCE_TABLES / DECONSOLIDATED_TABLES
 * constants so that adding a new bank account automatically includes it in all queries.
 *
 * @param insiderUuids  Optional list of insider UUIDs to restrict to specific insiders' accounts.
 */
export async function getSourceTables(insiderUuids?: string[]): Promise<string[]> {
  const clean = (insiderUuids ?? []).filter((u) => UUID_RE.test(u));
  const insiderFilter = clean.length > 0
    ? `AND insider_uuid = ANY(ARRAY[${clean.map((u) => `'${u}'::uuid`).join(', ')}]::uuid[])`
    : '';
  const rows = await prisma.$queryRawUnsafe<{ raw_table_name: string }[]>(
    `SELECT raw_table_name FROM bank_accounts WHERE raw_table_name IS NOT NULL AND raw_table_name <> '' AND is_active = true ${insiderFilter} ORDER BY id`
  );
  return rows.map((r) => r.raw_table_name);
}
