import { prisma } from '@/lib/prisma';

export type RequiredInsider = {
  insiderUuid: string;
  insiderName: string;
};

export async function getRequiredInsider(): Promise<RequiredInsider> {
  const rows = await prisma.$queryRaw<Array<{ insider_uuid: string; insider_name: string | null }>>`
    SELECT
      c.counteragent_uuid AS insider_uuid,
      COALESCE(c.insider_name, c.counteragent, c.name) AS insider_name
    FROM counteragents c
    WHERE c.insider = true
    ORDER BY c.id ASC
    LIMIT 1
  `;

  const row = rows[0];
  if (!row?.insider_uuid) {
    throw new Error('No insider counteragent found (counteragents.insider=true)');
  }

  return {
    insiderUuid: row.insider_uuid,
    insiderName: row.insider_name || row.insider_uuid,
  };
}
