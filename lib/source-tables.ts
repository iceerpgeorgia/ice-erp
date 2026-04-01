import { prisma } from '@/lib/prisma';

/**
 * Returns the list of all deconsolidated raw bank table names configured
 * in the bank_accounts table. This replaces hardcoded SOURCE_TABLES / DECONSOLIDATED_TABLES
 * constants so that adding a new bank account automatically includes it in all queries.
 */
export async function getSourceTables(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ raw_table_name: string }[]>(
    `SELECT raw_table_name FROM bank_accounts WHERE raw_table_name IS NOT NULL AND raw_table_name <> '' AND is_active = true ORDER BY id`
  );
  return rows.map((r) => r.raw_table_name);
}
