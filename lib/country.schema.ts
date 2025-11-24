// lib/country.schema.ts
import { z } from "zod";

export const CountrySchema = z.object({
  ts: z.coerce.date().default(new Date()),
  country_uuid: z.string().uuid().optional(), // server will generate if omitted
  name_en: z
    .string()
    .min(1, "Required")
    .regex(/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/, "Only English letters, spaces and hyphens"),
  name_ka: z
    .string()
    .min(1, "Required")
    .regex(/^[ა-ჰ]+(?:[ -][ა-ჰ]+)*$/, "Only Georgian letters, spaces and hyphens"),
  iso2: z
    .string()
    .min(2, "2 letters required")
    .max(2, "2 letters only")
    .transform((s) => (s ?? "").toUpperCase())
    .refine((s) => /^[A-Z]{2}$/.test(s), "2 uppercase letters"),
  iso3: z
    .string()
    .min(3, "3 letters required")
    .max(3, "3 letters only")
    .transform((s) => (s ?? "").toUpperCase())
    .refine((s) => /^[A-Z]{3}$/.test(s), "3 uppercase letters"),
  un_code: z.coerce.number().int().optional(),
});

export type CountryInput = z.infer<typeof CountrySchema>;
