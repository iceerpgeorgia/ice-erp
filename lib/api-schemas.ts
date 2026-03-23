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
