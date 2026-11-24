// Activation Date = the Tbilisi calendar day of a waybill's activation_time, shown as dd.mm.yyyy.
// activation_time holds real instants, so a waybill activated at 01:30 Tbilisi time is still the
// previous day in UTC; the date must be taken in Asia/Tbilisi (UTC+4, no daylight saving).
const TBILISI_OFFSET = '+04:00';
const TBILISI_OFFSET_MS = 4 * 60 * 60 * 1000;

export const formatActivationDate = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const local = new Date(date.getTime() + TBILISI_OFFSET_MS);
  const day = String(local.getUTCDate()).padStart(2, '0');
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${local.getUTCFullYear()}`;
};

// dd.mm.yyyy -> the instants [start, end) of that Tbilisi day, or null for anything else.
export const parseActivationDateRange = (value: string): { start: Date; end: Date } | null => {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const start = new Date(`${year}-${month}-${day}T00:00:00.000${TBILISI_OFFSET}`);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};
