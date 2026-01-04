// Generate sample report data
export interface ReportData {
  Counteragent: string;
  PaymentID: string;
  Code: string;
  Currency: string;
  FinancialCode: string;
  IncomeTax: boolean;
  Project: string;
  Job: string;
  Floors: number;
  Accrual: number;
  Order: number;
  Paid: number;
  AccrualPerFloor: number;
  PaidPercent: number;
  Balance: number;
  Due: number;
}

const counteragents = [
  'ABC Corporation', 'XYZ Industries', 'Global Solutions Ltd', 'Tech Innovations Inc',
  'Metro Builders', 'Prime Contractors', 'Elite Services', 'Apex Development',
  'Stellar Enterprises', 'Nexus Group', 'Quantum Systems', 'Pinnacle Holdings',
  'Vanguard Corp', 'Summit Partners', 'Horizon Ventures', 'Atlas Corporation',
  'Fusion Industries', 'Omega Services', 'Delta Solutions', 'Sigma Consulting'
];

const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];
const projects = ['Project Alpha', 'Project Beta', 'Project Gamma', 'Project Delta', 'Project Epsilon', 'Project Zeta', 'Project Eta', 'Project Theta'];
const jobs = ['Construction', 'Installation', 'Maintenance', 'Consulting', 'Design', 'Engineering', 'Management', 'Support'];
const financialCodes = ['FC-001', 'FC-002', 'FC-003', 'FC-004', 'FC-005', 'FC-006', 'FC-007', 'FC-008', 'FC-009', 'FC-010'];

function generateCode(): string {
  const prefix = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const number = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `${prefix}${number}`;
}

function generatePaymentID(): string {
  const year = 2024;
  const number = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  return `PAY-${year}-${number}`;
}

const generatedData: ReportData[] = [];

// Generate 500 records
for (let i = 0; i < 500; i++) {
  const floors = Math.floor(Math.random() * 50) + 1;
  const accrual = Math.floor((Math.random() * 100000 + 10000) * 100) / 100;
  const order = Math.floor((Math.random() * 80000 + 5000) * 100) / 100;
  const paid = Math.floor((Math.random() * 60000) * 100) / 100;
  const accrualPerFloor = floors > 0 ? Math.floor((accrual / floors) * 100) / 100 : 0;
  const paidPercent = accrual > 0 ? Math.floor((paid / accrual) * 10000) / 100 : 0;
  const balance = Math.floor((accrual - paid) * 100) / 100;
  const due = Math.floor((Math.random() * 30000) * 100) / 100;

  generatedData.push({
    Counteragent: counteragents[Math.floor(Math.random() * counteragents.length)],
    PaymentID: generatePaymentID(),
    Code: generateCode(),
    Currency: currencies[Math.floor(Math.random() * currencies.length)],
    FinancialCode: financialCodes[Math.floor(Math.random() * financialCodes.length)],
    IncomeTax: Math.random() > 0.5,
    Project: projects[Math.floor(Math.random() * projects.length)],
    Job: jobs[Math.floor(Math.random() * jobs.length)],
    Floors: floors,
    Accrual: accrual,
    Order: order,
    Paid: paid,
    AccrualPerFloor: accrualPerFloor,
    PaidPercent: paidPercent,
    Balance: balance,
    Due: due
  });
}

export const reportData = generatedData;

export interface ColumnConfig {
  key: keyof ReportData;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'percent';
  format?: string;
  canHide: boolean;
  isAggregatable?: boolean;
}

export const columnConfigs: ColumnConfig[] = [
  { key: 'Counteragent', label: 'Counteragent', type: 'text', canHide: false },
  { key: 'PaymentID', label: 'Payment ID', type: 'text', canHide: true },
  { key: 'Code', label: 'Code', type: 'text', canHide: true },
  { key: 'Currency', label: 'Currency', type: 'text', canHide: true },
  { key: 'FinancialCode', label: 'Financial Code', type: 'text', canHide: true },
  { key: 'IncomeTax', label: 'Income Tax', type: 'boolean', canHide: true },
  { key: 'Project', label: 'Project', type: 'text', canHide: true },
  { key: 'Job', label: 'Job', type: 'text', canHide: true },
  { key: 'Floors', label: 'Floors', type: 'number', format: '00', canHide: true, isAggregatable: true },
  { key: 'Accrual', label: 'Accrual', type: 'number', format: '00.00', canHide: true, isAggregatable: true },
  { key: 'Order', label: 'Order', type: 'number', format: '00.00', canHide: true, isAggregatable: true },
  { key: 'Paid', label: 'Paid', type: 'number', format: '00.00', canHide: true, isAggregatable: true },
  { key: 'AccrualPerFloor', label: 'Accrual/Floors', type: 'number', format: '00.00', canHide: true },
  { key: 'PaidPercent', label: 'Paid %', type: 'percent', canHide: true },
  { key: 'Balance', label: 'Balance', type: 'number', format: '00.00', canHide: true, isAggregatable: true },
  { key: 'Due', label: 'Due', type: 'number', format: '00.00', canHide: true, isAggregatable: true }
];
