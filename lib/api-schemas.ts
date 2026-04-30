import { z } from "zod";

// ── Brands ────────────────────────────────────────────────────────────
export const createBrandSchema = z.object({
  name: z.string().min(1, "Brand name is required").max(255),
  counteragentUuids: z.array(z.string().uuid()).optional().default([]),
});

export const updateBrandSchema = z.object({
  id: z.coerce.number().int().positive("Brand ID is required"),
  name: z.string().min(1, "Brand name is required").max(255),
  counteragentUuids: z.array(z.string().uuid()).optional().default([]),
});

// ── Banks ─────────────────────────────────────────────────────────────
export const createBankSchema = z.object({
  bankName: z.string().min(1, "Bank name is required").max(255),
});

// ── Currencies ────────────────────────────────────────────────────────
export const createCurrencySchema = z.object({
  code: z.string().min(1).max(10),
  name_en: z.string().min(1).max(255),
  name_ka: z.string().min(1).max(255),
  symbol: z.string().max(10).optional().default(""),
  is_active: z.boolean().optional().default(true),
});

export const updateCurrencySchema = createCurrencySchema.partial().extend({
  active: z.boolean().optional(),
});

// ── Countries ─────────────────────────────────────────────────────────
export const createCountrySchema = z.object({
  name_en: z.string().min(1, "Enter English country name").max(255),
  name_ka: z.string().min(1, "Enter Georgian country name").max(255),
  iso2: z.string().length(2).toUpperCase(),
  iso3: z.string().length(3).toUpperCase(),
  country: z.string().min(1).max(255),
  un_code: z.number().int().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

// ── Entity Types ──────────────────────────────────────────────────────
export const createEntityTypeSchema = z.object({
  name_en: z.string().min(1, "Enter English name").max(255),
  name_ka: z.string().min(1, "Enter Georgian name").max(255),
  is_active: z.boolean().optional().default(true),
  is_natural_person: z.boolean().optional().default(false),
});

// ── Dimensions ────────────────────────────────────────────────────────
export const createDimensionSchema = z.object({
  dimension: z.string().min(1, "Enter dimension").max(100),
  is_active: z.boolean().optional().default(true),
});

// ── Inventory Groups ──────────────────────────────────────────────────
export const createInventoryGroupSchema = z.object({
  name: z.string().min(1, "Enter group name").max(255),
  dimension_uuid: z.string().uuid("Invalid dimension").optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

// ── Inventories ───────────────────────────────────────────────────────
export const createInventorySchema = z.object({
  name: z.string().min(1, "Enter inventory name").max(255),
  producer_uuid: z.string().uuid().optional().nullable(),
  inventory_group_uuid: z.string().uuid().optional().nullable(),
  dimension_uuid: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

// ── Financial Codes ───────────────────────────────────────────────────
export const createFinancialCodeSchema = z.object({
  code: z.string().min(1, "Enter code").max(50),
  name_en: z.string().min(1, "Enter English name").max(255),
  name_ka: z.string().min(1, "Enter Georgian name").max(255),
  is_active: z.boolean().optional().default(true),
});

// ── Exchange Rates ────────────────────────────────────────────────────
export const createExchangeRateSchema = z.object({
  date: z.coerce.date(),
  usd: z.coerce.number().optional(),
  eur: z.coerce.number().optional(),
  cny: z.coerce.number().optional(),
  gbp: z.coerce.number().optional(),
  rub: z.coerce.number().optional(),
  try: z.coerce.number().optional(),
  aed: z.coerce.number().optional(),
  kzt: z.coerce.number().optional(),
});

// ── Helper: format Zod errors to match existing API response shape ───
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!details[key]) {
      details[key] = issue.message;
    }
  }
  return details;
}

// ── Payments ──────────────────────────────────────────────────────────
export const createPaymentSchema = z.object({
  projectUuid: z.string().uuid().optional().nullable(),
  counteragentUuid: z.string().uuid().optional().nullable(),
  financialCodeUuid: z.string().uuid().optional().nullable(),
  jobUuid: z.string().uuid().optional().nullable(),
  currencyUuid: z.string().uuid().optional().nullable(),
  paymentId: z.string().min(1).max(255).optional().nullable(),
  incomeTax: z.coerce.number().nullable().optional(),
  accrualSource: z.string().max(255).optional().nullable(),
  label: z.string().max(255).optional().nullable(),
  insiderUuid: z.string().uuid().optional().nullable(),
  insider_uuid: z.string().uuid().optional().nullable(),
  isRecurring: z.boolean().optional(),
});

export const updatePaymentSchema = createPaymentSchema.partial();

// ── Payments Ledger ───────────────────────────────────────────────────
export const createLedgerEntrySchema = z.object({
  payment_uuid: z.string().uuid(),
  amount: z.coerce.number(),
  date: z.coerce.date().optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
  insider_uuid: z.string().uuid().optional().nullable(),
});

export const updateLedgerEntrySchema = createLedgerEntrySchema.partial();

// ── Adjustments ───────────────────────────────────────────────────────
export const createAdjustmentSchema = z.object({
  payment_uuid: z.string().uuid().optional().nullable(),
  amount: z.coerce.number(),
  comment: z.string().max(2000).optional().nullable(),
  date: z.coerce.date().optional().nullable(),
  counteragent_uuid: z.string().uuid().optional().nullable(),
  financial_code_uuid: z.string().uuid().optional().nullable(),
  project_uuid: z.string().uuid().optional().nullable(),
  insider_uuid: z.string().uuid().optional().nullable(),
});

// ── Jobs ──────────────────────────────────────────────────────────────
export const createJobSchema = z.object({
  jobName: z.string().min(1).max(255),
  brandUuid: z.string().uuid().optional().nullable(),
  projectUuids: z.array(z.string().uuid()).optional().default([]),
  insiderUuid: z.string().uuid().optional().nullable(),
});

// ── Projects ──────────────────────────────────────────────────────────
export const updateProjectSchema = z.object({
  projectName: z.string().min(1).max(255).optional(),
  brandUuid: z.string().uuid().optional().nullable(),
  jobUuids: z.array(z.string().uuid()).optional(),
  insiderUuid: z.string().uuid().optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  service: z.string().max(255).optional().nullable(),
  department: z.string().max(255).optional().nullable(),
});

// ── Salary Accruals ───────────────────────────────────────────────────
export const createSalaryAccrualSchema = z.object({
  counteragent_uuid: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM"),
  base_salary: z.coerce.number().nullable().optional(),
  bonus: z.coerce.number().nullable().optional(),
  income_tax: z.coerce.number().nullable().optional(),
  pension: z.coerce.number().nullable().optional(),
  insurance: z.coerce.number().nullable().optional(),
  other: z.coerce.number().nullable().optional(),
  comment: z.string().max(2000).optional().nullable(),
  insider_uuid: z.string().uuid().optional().nullable(),
});

// ── Bank Transaction Batches ──────────────────────────────────────────
const partitionSchema = z.object({
  amount: z.coerce.number(),
  payment_id: z.string().min(1).max(255).optional().nullable(),
  payment_uuid: z.string().uuid().optional().nullable(),
  counteragent_uuid: z.string().uuid().optional().nullable(),
  financial_code_uuid: z.string().uuid().optional().nullable(),
  project_uuid: z.string().uuid().optional().nullable(),
});

export const createBatchSchema = z.object({
  bankAccountUuid: z.string().uuid(),
  rawRecordUuid: z.string().uuid(),
  rawRecordId1: z.coerce.number().int().optional().nullable(),
  rawRecordId2: z.coerce.number().int().optional().nullable(),
  replaceBatchUuid: z.string().uuid().optional().nullable(),
  partitions: z.array(partitionSchema).min(2, "A batch must have at least 2 partitions"),
});

// ── Users (admin) ─────────────────────────────────────────────────────
export const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().max(255).optional().nullable(),
  role: z.enum(["user", "admin", "system_admin"]).optional().default("user"),
});

export const updateUserSchema = z.object({
  isAuthorized: z.boolean().optional(),
  role: z.enum(["user", "admin", "system_admin"]).optional(),
  paymentNotifications: z.boolean().optional(),
});
