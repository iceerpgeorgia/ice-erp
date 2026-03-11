import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const INSIDER_SELECTION_COOKIE = 'insider-view-selection';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InsiderOption = {
  insiderUuid: string;
  insiderName: string;
};

export type InsiderSelection = {
  options: InsiderOption[];
  selectedUuids: string[];
  selectedInsiders: InsiderOption[];
  primaryInsider: InsiderOption | null;
};

function sanitizeUuidList(values: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!UUID_REGEX.test(normalized)) continue;
    const lowered = normalized.toLowerCase();
    if (seen.has(lowered)) continue;
    seen.add(lowered);
    clean.push(normalized);
  }
  return clean;
}

export function parseInsiderSelectionCookie(rawValue: string | undefined): string[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return sanitizeUuidList(parsed.map((v) => String(v)));
  } catch {
    return [];
  }
}

export function serializeInsiderSelectionCookie(selectedUuids: string[]): string {
  return JSON.stringify(sanitizeUuidList(selectedUuids));
}

export async function getInsiderOptions(): Promise<InsiderOption[]> {
  const rows = await prisma.$queryRaw<Array<{ insider_uuid: string; insider_name: string | null }>>`
    SELECT
      c.counteragent_uuid AS insider_uuid,
      COALESCE(c.insider_name, c.counteragent, c.name) AS insider_name
    FROM counteragents c
    WHERE c.insider = true
    ORDER BY c.id ASC
  `;

  return rows
    .filter((row) => UUID_REGEX.test(String(row.insider_uuid || '').trim()))
    .map((row) => ({
      insiderUuid: row.insider_uuid,
      insiderName: row.insider_name || row.insider_uuid,
    }));
}

export async function resolveInsiderSelection(request?: NextRequest): Promise<InsiderSelection> {
  const options = await getInsiderOptions();
  const optionSet = new Set(options.map((option) => option.insiderUuid.toLowerCase()));

  const cookieRaw = request?.cookies.get(INSIDER_SELECTION_COOKIE)?.value;
  const cookieSelection = parseInsiderSelectionCookie(cookieRaw);
  const validCookieSelection = cookieSelection.filter((uuid) => optionSet.has(uuid.toLowerCase()));

  const selectedUuids = validCookieSelection.length > 0
    ? validCookieSelection
    : options.map((option) => option.insiderUuid);

  const selectedSet = new Set(selectedUuids.map((uuid) => uuid.toLowerCase()));
  const selectedInsiders = options.filter((option) => selectedSet.has(option.insiderUuid.toLowerCase()));

  return {
    options,
    selectedUuids,
    selectedInsiders,
    primaryInsider: selectedInsiders[0] ?? null,
  };
}

export function sqlUuidInList(selectedUuids: string[]): string {
  const clean = sanitizeUuidList(selectedUuids);
  if (clean.length === 0) return 'NULL';
  return clean.map((uuid) => `'${uuid}'::uuid`).join(', ');
}
