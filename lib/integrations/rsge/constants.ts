/**
 * Code → label mappings for rs.ge WaybillService API.
 *
 * The SOAP get_buyer_waybills response returns numeric codes for STATUS and TYPE.
 * These mappings translate them to the Georgian display labels used in the portal
 * and in legacy CSV imports.
 *
 * Source: verified against existing DB records that had both labels (CSV import)
 * and codes (SOAP import) for the same waybill IDs.
 */

// ---------------------------------------------------------------------------
// Waybill STATUS codes
// ---------------------------------------------------------------------------

export const RS_WAYBILL_STATUS: Record<string, string> = {
  '1': 'აქტიური',
  '2': 'დასრულებული',
  '-1': 'შეჩერებული',
  '-2': 'გაუქმებული',
};

// ---------------------------------------------------------------------------
// Waybill TYPE codes
// ---------------------------------------------------------------------------

export const RS_WAYBILL_TYPE: Record<string, string> = {
  '1': 'ტრანსპორტირების გარეშე',
  '2': 'ტრანსპორტირებით',
  '3': 'უკან დაბრუნება',
  '4': 'ქვე-ზედნადები',
  '5': 'შიდა გადაზიდვა',
};

// ---------------------------------------------------------------------------
// Waybill CONDITION — derived from IS_CONFIRMED flag
// ---------------------------------------------------------------------------

export const RS_WAYBILL_CONDITION: Record<string, string> = {
  '0': 'მისაღები',
  '1': 'მიღებული',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function rsWaybillStatusLabel(code: string | null | undefined): string {
  if (!code) return '';
  return RS_WAYBILL_STATUS[code] ?? code;
}

export function rsWaybillTypeLabel(code: string | null | undefined): string {
  if (!code) return '';
  return RS_WAYBILL_TYPE[code] ?? code;
}

export function rsWaybillConditionLabel(isConfirmedCode: string | null | undefined): string {
  if (!isConfirmedCode) return 'მისაღები';
  return RS_WAYBILL_CONDITION[isConfirmedCode] ?? 'მისაღები';
}
