// Auto-generated Zod schemas from data_validation_spec.xlsx
import { z } from "zod";

export const CounteragentsSchema = z.object({
  Timestamp: z.coerce.date(),
  Name: z.string(),
  Sex: z.string(),
  "Entity Type": z.string(),
  "Pension Scheme": z.coerce.boolean(),
  "Tax ID": z
    .string()
    .regex(new RegExp('^[\\w\\-\\.:/]{1,128}$'))
    .optional(),
  Country: z.string(),
  "Address Line 1 ::": z.string().optional(),
  "Address Line 2 ::": z.string().optional(),
  "ZIP Code ::": z.string().optional(),
  Director: z.string().optional(),
  "Director ID": z
    .string()
    .regex(new RegExp('^[\\w\\-\\.:/]{1,128}$'))
    .optional(),
  "SWIFT ::": z.string().optional(),
  "IBAN ::": z
    .string()
    .regex(new RegExp('^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$'), 'Invalid IBAN')
    .regex(new RegExp('^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$'))
    .optional(),
  "Tel. No ::": z.string().optional(),
  "Counteragent UUID": z
    .string()
    .regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')),
  "Email ::": z
    .string()
    .regex(new RegExp('^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'))
    .optional(),
  "Date of incorporation or birth": z.string(),
  "ORIS ID ::": z.string().optional(),
  "Internal No": z.string(),
  Counteragent: z.string(),
  "Country UUID": z
    .string()
    .regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')),
  "Entity Type UUID": z
    .string()
    .regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')),
});

export const CountriesSchema = z.object({
  Timestamp: z.coerce.date(),
  "Country UUID": z
    .string()
    .regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')),
  "Country Name English": z.string(),
  "Country Name Georgian": z.string(),
  "ISO 2": z.string().regex(new RegExp('^[A-Z]{2,3}$')),
  "ISO 3": z.string().regex(new RegExp('^[A-Z]{2,3}$')),
  "UN Code": z.string(),
  Country: z.string(),
});

export const EntityTypesSchema = z.object({
  Timestamp: z.coerce.date(),
  "Entity Type UUID": z
    .string()
    .regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')),
  "Entity Type Name": z.string(),
});

