// Auto-generated Zod schemas from data_validation_spec.xlsx
import { z } from "zod";


export const CounteragentsSchema = z.object({
  Timestamp: z.coerce.date(),
  Name: z.string(),
  Sex: z.string(),
  Entity Type: z.string(),
  Pension Scheme: z.coerce.boolean(),
  Tax ID: z.string().regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')).optional() /* unique */,
  Country: z.string(),
  Address Line 1 :: z.string().optional(),
  Address Line 2 :: z.string().optional(),
  ZIP Code :: z.string().optional(),
  Director: z.string().optional(),
  Director ID: z.string().regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')).optional(),
  SWIFT :: z.string().optional(),
  IBAN :: z.string().regex(new RegExp('^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$'), 'Invalid IBAN').regex(new RegExp('^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$')).optional(),
  Tel. No :: z.string().optional(),
  Counteragent UUID: z.string().regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')) /* FK -> Counteragents.Counteragent UUID */ /* unique */,
  Email :: z.string().regex(new RegExp('^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$')).optional(),
  Date of incorporation or birth: z.string(),
  ORIS ID :: z.string().optional() /* unique */,
  Internal No: z.string() /* unique */,
  Counteragent: z.string() /* unique */,
  Country UUID: z.string().regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')),
  Entity Type UUID: z.string().regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')),
});

export const CountriesSchema = z.object({
  Timestamp: z.coerce.date(),
  Country UUID: z.string().regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')) /* FK -> Countries.Country UUID */ /* unique */,
  Country Name English: z.string() /* unique */,
  Country Name Georgian: z.string() /* unique */,
  ISO 2: z.string().regex(new RegExp('^[A-Z]{2,3}$')) /* unique */,
  ISO 3: z.string().regex(new RegExp('^[A-Z]{2,3}$')) /* unique */,
  UN Code: z.string() /* unique */,
  Country: z.string() /* unique */,
});

export const Entity TypesSchema = z.object({
  Timestamp: z.coerce.date() /* unique */,
  Entity Type UUID: z.string().regex(new RegExp('^[\\w\\-\\.:/]{1,128}$')) /* FK -> Entity Types.Entity Type UUID */ /* unique */,
  Entity Type Name: z.string() /* unique */,
});
