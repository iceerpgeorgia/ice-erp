const DD_MM_YYYY_REGEX = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const YYYY_MM_DD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (value: number): string => String(value).padStart(2, '0');

const isValidDateParts = (year: number, month: number, day: number): boolean => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

const formatIso = (year: number, month: number, day: number): string =>
  `${year}-${pad2(month)}-${pad2(day)}`;

export const normalizeToIsoDate = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const ddmmyyyy = raw.match(DD_MM_YYYY_REGEX);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const year = Number(ddmmyyyy[3]);
    return isValidDateParts(year, month, day) ? formatIso(year, month, day) : null;
  }

  const yyyymmdd = raw.slice(0, 10).match(YYYY_MM_DD_REGEX);
  if (yyyymmdd) {
    const year = Number(yyyymmdd[1]);
    const month = Number(yyyymmdd[2]);
    const day = Number(yyyymmdd[3]);
    return isValidDateParts(year, month, day) ? formatIso(year, month, day) : null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatIso(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
};

export const isoToDisplayDate = (isoDate: string): string => {
  const match = isoDate.match(YYYY_MM_DD_REGEX);
  if (!match) return '';
  return `${match[3]}.${match[2]}.${match[1]}`;
};

export const toDisplayDate = (value: unknown): string => {
  const isoDate = normalizeToIsoDate(value);
  return isoDate ? isoToDisplayDate(isoDate) : '';
};

export const toDateInputValue = (value: unknown): string => normalizeToIsoDate(value) ?? '';

export const toDateSortTimestamp = (value: unknown): number => {
  const isoDate = normalizeToIsoDate(value);
  if (!isoDate) return Number.NEGATIVE_INFINITY;
  return Date.parse(`${isoDate}T00:00:00Z`);
};