import { ORIS_LETTERS } from './entries';

/**
 * The organisations list exported from ORIS (ORGANISATIONS.XLSX): column A the ORIS code as text
 * ("0042"), B the tax ID (often empty), C the name in the ORIS font, usually ending with the tax ID
 * ("ÛÐÓ ... Ó/Í 123456789"), D the address. Row 1 is the header.
 */
export type OrisOrganisation = {
  row: number;
  /** The code as a number written out: "0042" → "42", like the ORIS IDs stored on counteragents. */
  code: string;
  /** Tax ID from column B, else the last 9 or 11 digit number in the name; null when neither has one. */
  taxId: string | null;
  /** The name converted from the ORIS font to Georgian letters. */
  name: string;
};

const GEORGIAN_FROM_ORIS: Record<string, string> = Object.fromEntries(
  Object.entries(ORIS_LETTERS)
    .filter(([georgian]) => /[ა-ჰ]/.test(georgian))
    .map(([georgian, oris]) => [oris, georgian])
);

/** ORIS font → Georgian letters (the reverse of toOrisFont, letters only). */
export const fromOrisFont = (value: string) => value.replace(/[À-ÿ]/g, (ch) => GEORGIAN_FROM_ORIS[ch] ?? ch);

const TAX_ID_RE = /^\d{9}$|^\d{11}$/;

/** Tax IDs compared without leading zeros (some are stored with a leading 0 added to 10 digits). */
export const taxIdKey = (taxId: string) => taxId.trim().replace(/^0+/, '');

export function parseOrisOrganisations(rows: unknown[][]): { organisations: OrisOrganisation[]; badCodes: number[] } {
  const organisations: OrisOrganisation[] = [];
  const badCodes: number[] = [];
  rows.slice(1).forEach((cells, index) => {
    const row = index + 2;
    const rawCode = String(cells[0] ?? '').trim();
    const rawName = String(cells[2] ?? '').trim();
    if (!rawCode && !rawName) return;
    if (!/^\d+$/.test(rawCode)) {
      badCodes.push(row);
      return;
    }
    const columnB = String(cells[1] ?? '').trim();
    let taxId: string | null = TAX_ID_RE.test(columnB) ? columnB : null;
    if (!taxId) {
      const found = rawName.match(/(?<!\d)(\d{11}|\d{9})(?!\d)/g);
      taxId = found ? found[found.length - 1] : null;
    }
    organisations.push({ row, code: String(Number(rawCode)), taxId, name: fromOrisFont(rawName) });
  });
  return { organisations, badCodes };
}

export type OrisIdChange = {
  counteragentId: bigint;
  counteragentUuid: string;
  counteragent: string;
  to: string;
};

export type OrganisationsPlan = {
  /** Counteragents without an ORIS ID that get the code of the file's only organisation with their tax ID. */
  changes: OrisIdChange[];
  /** Counteragents that already have one of the file's codes for their tax ID. */
  unchanged: number;
  /** Counteragents whose ORIS ID is not among the file's codes for their tax ID: listed, never changed. */
  differs: Array<{ counteragent: string; current: string; codes: string[] }>;
  /** No ORIS ID yet, but ORIS has several organisations with the tax ID. */
  ambiguous: Array<{ counteragent: string; codes: string[] }>;
  /** The code already belongs to a counteragent with another tax ID. */
  conflicts: Array<{ counteragent: string; code: string; owner: string }>;
  /** Tax IDs in the file without a counteragent. */
  noCounteragent: Array<{ row: number; code: string; taxId: string; name: string }>;
  /** Rows without a tax ID (matched by nothing). */
  noTaxId: Array<{ row: number; code: string; name: string }>;
};

export type CounteragentRow = {
  id: bigint;
  counteragent_uuid: string;
  label: string;
  tax_id: string | null;
  oris_id: string | null;
};

/**
 * Decide the ORIS ID of every counteragent whose tax ID is in the file (decided 2026-11-26): only a
 * counteragent without an ORIS ID gets one, and only when exactly one organisation in the file has
 * its tax ID and no other counteragent holds that code. Existing ORIS IDs are never changed.
 * `counteragents` must hold the counteragents with those tax IDs plus every counteragent holding
 * one of the file's codes (to detect codes already in use).
 */
export function planOrganisations(organisations: OrisOrganisation[], counteragents: CounteragentRow[]): OrganisationsPlan {
  const plan: OrganisationsPlan = { changes: [], unchanged: 0, differs: [], ambiguous: [], conflicts: [], noCounteragent: [], noTaxId: [] };

  const codesByTaxId = new Map<string, OrisOrganisation[]>();
  for (const org of organisations) {
    if (!org.taxId) {
      plan.noTaxId.push({ row: org.row, code: org.code, name: org.name });
      continue;
    }
    const key = taxIdKey(org.taxId);
    codesByTaxId.set(key, [...(codesByTaxId.get(key) ?? []), org]);
  }

  const byTaxId = new Map<string, CounteragentRow[]>();
  const holdersByCode = new Map<string, CounteragentRow[]>();
  for (const ca of counteragents) {
    if (ca.tax_id) byTaxId.set(taxIdKey(ca.tax_id), [...(byTaxId.get(taxIdKey(ca.tax_id)) ?? []), ca]);
    const current = ca.oris_id?.trim();
    if (current) holdersByCode.set(current, [...(holdersByCode.get(current) ?? []), ca]);
  }

  for (const [key, orgs] of codesByTaxId) {
    const matches = byTaxId.get(key);
    if (!matches) {
      for (const org of orgs) plan.noCounteragent.push({ row: org.row, code: org.code, taxId: org.taxId!, name: org.name });
      continue;
    }
    const codes = orgs.map((o) => o.code);
    for (const ca of matches) {
      const current = ca.oris_id?.trim() || null;
      if (current) {
        if (codes.includes(current)) plan.unchanged += 1;
        else plan.differs.push({ counteragent: ca.label, current, codes });
        continue;
      }
      if (codes.length > 1) {
        plan.ambiguous.push({ counteragent: ca.label, codes });
        continue;
      }
      const code = codes[0];
      const owner = (holdersByCode.get(code) ?? []).find((h) => !h.tax_id || taxIdKey(h.tax_id) !== key);
      if (owner) {
        plan.conflicts.push({ counteragent: ca.label, code, owner: owner.label });
        continue;
      }
      plan.changes.push({ counteragentId: ca.id, counteragentUuid: ca.counteragent_uuid, counteragent: ca.label, to: code });
    }
  }
  return plan;
}
