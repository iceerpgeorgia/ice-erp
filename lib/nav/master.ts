export type MasterNavItem = {
  routeKey: string;
  label: string;
  defaultIcon: string;
  defaultGroup: string;
  desc: string;
};

export const MASTER_NAV: MasterNavItem[] = [
  // Banking
  { routeKey: '/dictionaries/bank-transactions', label: 'Bank Transactions', defaultIcon: 'Landmark', defaultGroup: 'Banking', desc: 'BOG/NBG statement import' },
  { routeKey: '/bank-transaction-batches', label: 'TX Batches', defaultIcon: 'Layers2', defaultGroup: 'Banking', desc: 'Batch payment processing' },
  { routeKey: '/dictionaries/waybills', label: 'Waybills In', defaultIcon: 'ClipboardList', defaultGroup: 'Banking', desc: 'RS.ge buyer waybills' },
  { routeKey: '/dictionaries/waybill-items', label: 'Waybill Items', defaultIcon: 'ListTree', defaultGroup: 'Banking', desc: 'Line-item detail' },

  // Finance
  { routeKey: '/dictionaries/payments', label: 'Payments', defaultIcon: 'Wallet', defaultGroup: 'Finance', desc: 'Payment records' },
  { routeKey: '/dictionaries/payments-ledger', label: 'Payments Ledger', defaultIcon: 'ReceiptText', defaultGroup: 'Finance', desc: 'Ledger entries' },
  { routeKey: '/dictionaries/payment-redistribution', label: 'Payment Redistribution', defaultIcon: 'ArrowLeftRight', defaultGroup: 'Finance', desc: 'Reallocation' },
  { routeKey: '/dictionaries/salary-accruals', label: 'Salary Accruals', defaultIcon: 'DollarSign', defaultGroup: 'Finance', desc: 'Payroll accruals' },
  { routeKey: '/dictionaries/nbg-rates', label: 'NBG Rates', defaultIcon: 'TrendingUp', defaultGroup: 'Finance', desc: 'Exchange rates' },
  { routeKey: '/dictionaries/conversions', label: 'Conversions', defaultIcon: 'Scale', defaultGroup: 'Finance', desc: 'Currency conversions' },
  { routeKey: '/handovers', label: 'Handovers', defaultIcon: 'ClipboardList', defaultGroup: 'Finance', desc: 'Project job handovers' },

  // Reports
  { routeKey: '/dictionaries/payments-report', label: 'Payments Report', defaultIcon: 'FileBarChart2', defaultGroup: 'Reports', desc: 'By project & code' },
  { routeKey: '/dictionaries/projects-report', label: 'Projects Report', defaultIcon: 'BarChart3', defaultGroup: 'Reports', desc: 'Project financials' },
  { routeKey: '/dictionaries/services-report', label: 'Services Report', defaultIcon: 'FileSpreadsheet', defaultGroup: 'Reports', desc: 'Service breakdown' },

  // Dictionaries
  { routeKey: '/dictionaries/counteragents', label: 'Counteragents', defaultIcon: 'UserCheck', defaultGroup: 'Dictionaries', desc: 'Suppliers & clients' },
  { routeKey: '/admin/projects', label: 'Projects', defaultIcon: 'Building2', defaultGroup: 'Dictionaries', desc: 'Project registry' },
  { routeKey: '/dictionaries/jobs', label: 'Jobs', defaultIcon: 'Layers2', defaultGroup: 'Dictionaries', desc: 'Job definitions' },
  { routeKey: '/dictionaries/banks', label: 'Banks', defaultIcon: 'Landmark', defaultGroup: 'Dictionaries', desc: 'Bank reference data' },
  { routeKey: '/dictionaries/bank-accounts', label: 'Bank Accounts', defaultIcon: 'Banknote', defaultGroup: 'Dictionaries', desc: 'Account registry' },
  { routeKey: '/dictionaries/currencies', label: 'Currencies', defaultIcon: 'Globe', defaultGroup: 'Dictionaries', desc: 'Currency list' },
  { routeKey: '/dictionaries/countries', label: 'Countries', defaultIcon: 'Globe', defaultGroup: 'Dictionaries', desc: 'Country registry' },
  { routeKey: '/dictionaries/entity-types', label: 'Entity Types', defaultIcon: 'ListTree', defaultGroup: 'Dictionaries', desc: 'Legal entity types' },
  { routeKey: '/dictionaries/parsing-scheme-rules', label: 'Parsing Rules', defaultIcon: 'Settings', defaultGroup: 'Dictionaries', desc: 'Transaction parsing logic' },
  { routeKey: '/dictionaries/inventories', label: 'Inventories', defaultIcon: 'Package', defaultGroup: 'Dictionaries', desc: 'Inventory items' },
  { routeKey: '/dictionaries/dimensions', label: 'Dimensions', defaultIcon: 'Scale', defaultGroup: 'Dictionaries', desc: 'Units of measure' },

  // Admin
  { routeKey: '/admin/users', label: 'Users', defaultIcon: 'Users', defaultGroup: 'Admin', desc: 'User management' },
  { routeKey: '/admin/financial-codes', label: 'Financial Codes', defaultIcon: 'BookOpen', defaultGroup: 'Admin', desc: 'Chart of accounts' },
  { routeKey: '/admin/attachments', label: 'Attachments', defaultIcon: 'FileSpreadsheet', defaultGroup: 'Admin', desc: 'File attachments' },
  { routeKey: '/admin/document-types', label: 'Document Types', defaultIcon: 'ClipboardList', defaultGroup: 'Admin', desc: 'Document registry' },
  { routeKey: '/admin/permissions', label: 'Permissions', defaultIcon: 'ShieldCheck', defaultGroup: 'Admin', desc: 'Role permissions' },
];

export const MASTER_BY_ROUTE = Object.fromEntries(MASTER_NAV.map(i => [i.routeKey, i]));
