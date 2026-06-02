/**
 * Default nav configuration template.
 * Seeded for every new user on their first /api/nav/config fetch.
 * Mirrors Giorgi's manually curated layout (the canonical reference config).
 *
 * Items with routeKey '/', '/admin/modules', '/admin/analytics' are intentionally
 * excluded: Home is pinned in the sidebar header; the other two are removed from MASTER_NAV.
 */

export type DefaultFolder = {
  name: string;
  sortOrder: number;
};

export type DefaultItem = {
  routeKey: string;
  /** Index into DEFAULT_FOLDERS — null means unassigned (not seeded) */
  folderIndex: number;
  sortOrder: number;
  icon: string | null;
};

export const DEFAULT_FOLDERS: DefaultFolder[] = [
  { name: 'Payments',               sortOrder: 0 },
  { name: 'Dictionaries',           sortOrder: 1 },
  { name: 'Financial Dictionaries', sortOrder: 2 },
  { name: 'RS.GE',                  sortOrder: 3 },
  { name: 'Salaries',               sortOrder: 4 },
  { name: 'Projects and Services',  sortOrder: 5 },
  { name: 'Admin',                  sortOrder: 6 },
];

export const DEFAULT_ITEMS: DefaultItem[] = [
  // Payments (0)
  { routeKey: '/dictionaries/payments-report',        folderIndex: 0, sortOrder: 0, icon: null },
  { routeKey: '/dictionaries/payments-ledger',        folderIndex: 0, sortOrder: 1, icon: null },
  { routeKey: '/dictionaries/payments',               folderIndex: 0, sortOrder: 2, icon: null },
  { routeKey: '/dictionaries/bank-transactions',      folderIndex: 0, sortOrder: 3, icon: null },
  { routeKey: '/dictionaries/conversions',            folderIndex: 0, sortOrder: 4, icon: null },
  { routeKey: '/bank-transaction-batches',            folderIndex: 0, sortOrder: 5, icon: null },
  { routeKey: '/dictionaries/parsing-scheme-rules',   folderIndex: 0, sortOrder: 6, icon: null },
  { routeKey: '/dictionaries/payment-redistribution', folderIndex: 0, sortOrder: 7, icon: null },

  // Dictionaries (1)
  { routeKey: '/admin/projects',             folderIndex: 1, sortOrder: 0, icon: null },
  { routeKey: '/dictionaries/counteragents', folderIndex: 1, sortOrder: 1, icon: null },
  { routeKey: '/dictionaries/jobs',          folderIndex: 1, sortOrder: 2, icon: null },
  { routeKey: '/dictionaries/currencies',    folderIndex: 1, sortOrder: 3, icon: null },
  { routeKey: '/dictionaries/countries',     folderIndex: 1, sortOrder: 4, icon: null },
  { routeKey: '/dictionaries/entity-types',  folderIndex: 1, sortOrder: 5, icon: null },
  { routeKey: '/admin/document-types',       folderIndex: 1, sortOrder: 6, icon: null },
  { routeKey: '/dictionaries/inventories',   folderIndex: 1, sortOrder: 7, icon: null },
  { routeKey: '/dictionaries/dimensions',    folderIndex: 1, sortOrder: 8, icon: null },
  { routeKey: '/admin/attachments',          folderIndex: 1, sortOrder: 9, icon: null },

  // Financial Dictionaries (2)
  { routeKey: '/admin/financial-codes',        folderIndex: 2, sortOrder: 0, icon: null },
  { routeKey: '/dictionaries/nbg-rates',       folderIndex: 2, sortOrder: 1, icon: null },
  { routeKey: '/dictionaries/banks',           folderIndex: 2, sortOrder: 2, icon: null },
  { routeKey: '/dictionaries/bank-accounts',   folderIndex: 2, sortOrder: 3, icon: null },

  // RS.GE (3)
  { routeKey: '/dictionaries/waybills',      folderIndex: 3, sortOrder: 0, icon: null },
  { routeKey: '/dictionaries/waybill-items', folderIndex: 3, sortOrder: 1, icon: null },

  // Salaries (4)
  { routeKey: '/dictionaries/salary-accruals', folderIndex: 4, sortOrder: 0, icon: null },

  // Projects and Services (5)
  { routeKey: '/dictionaries/projects-report', folderIndex: 5, sortOrder: 0, icon: null },
  { routeKey: '/dictionaries/services-report', folderIndex: 5, sortOrder: 1, icon: null },

  // Admin (6)
  { routeKey: '/admin/users',       folderIndex: 6, sortOrder: 0, icon: null },
  { routeKey: '/admin/permissions', folderIndex: 6, sortOrder: 1, icon: null },
];
