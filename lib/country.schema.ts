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
    .transform((s) => (s ?? "").toUpperCase())
    .regex(/^[A-Z]{2}$/, "2 uppercase letters"),
  iso3: z
    .string()
    .transform((s) => (s ?? "").toUpperCase())
    .regex(/^[A-Z]{3}$/, "3 uppercase letters"),
  un_code: z.coerce.number().int().optional(),
});

export type CountryInput = z.infer<typeof CountrySchema>;
