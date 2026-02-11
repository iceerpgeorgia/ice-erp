'use client';

export const loadColumnFilters = (storageKey: string) => {
  if (typeof window === 'undefined') return {} as Record<string, string[]>;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {} as Record<string, string[]>;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : ({} as Record<string, string[]>);
  } catch {
    return {} as Record<string, string[]>;
  }
};

export const saveColumnFilters = (storageKey: string, filters: Record<string, string[]>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(filters));
  } catch {
    // ignore storage errors
  }
};

export const clearColumnFilters = (storageKey: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore storage errors
  }
};

export const loadFilterMap = (storageKey: string) => {
  if (typeof window === 'undefined') return new Map<string, Set<any>>();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Map<string, Set<any>>();
    const parsed = JSON.parse(raw) as Record<string, any[]>;
    const map = new Map<string, Set<any>>();
    Object.entries(parsed || {}).forEach(([key, values]) => {
      map.set(key, new Set(values || []));
    });
    return map;
  } catch {
    return new Map<string, Set<any>>();
  }
};

export const saveFilterMap = (storageKey: string, filters: Map<string, Set<any>>) => {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, any[]> = {};
    filters.forEach((values, key) => {
      obj[key] = Array.from(values);
    });
    localStorage.setItem(storageKey, JSON.stringify(obj));
  } catch {
    // ignore storage errors
  }
};
