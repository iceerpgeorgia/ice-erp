/**
 * Code → label mappings for rs.ge WaybillService API.
 *
 * The SOAP get_buyer_waybills response returns numeric codes for STATUS and TYPE.
 * These mappings translate them to the Georgian display labels used in the portal
 * and in legacy CSV imports.
 *
 * Source: Verified by cross-referencing 215 API waybills against CSV portal export
 * labels, and confirmed against the official RS.ge waybill_protocol.pdf (v4.0.4).
 */

// ---------------------------------------------------------------------------
// Waybill STATUS codes
// ---------------------------------------------------------------------------

export const RS_WAYBILL_STATUS: Record<string, string> = {
  '0':  'შენახული',                    // Saved (draft, not yet activated)
  '1':  'აქტიური',                     // Active (in transit)
  '2':  'დასრულებული',                 // Completed / closed
  '8':  'გადამზიდავთან გადაგზავნილი', // Forwarded to carrier
  '-1': 'წაშლილი',                     // Deleted
  '-2': 'გაუქმებული',                  // Cancelled
};

// ---------------------------------------------------------------------------
// Waybill TYPE codes
// ---------------------------------------------------------------------------

export const RS_WAYBILL_TYPE: Record<string, string> = {
  '1': 'შიდა გადაზიდვა',
  '2': 'ტრანსპორტირებით',
  '3': 'ტრანსპორტირების გარეშე',
  '4': 'დისტრიბუცია',
  '5': 'უკან დაბრუნება',
  '6': 'ქვე-ზედნადები',
};

// ---------------------------------------------------------------------------
// Waybill CONDITION — derived from IS_CONFIRMED flag
// ---------------------------------------------------------------------------

export const RS_WAYBILL_CONDITION: Record<string, string> = {
  '0':  'მისაღები',   // IS_CONFIRMED=0: pending buyer confirmation
  '1':  'მიღებული',  // IS_CONFIRMED=1: buyer confirmed receipt
  '-1': 'უარყოფილი', // IS_CONFIRMED=-1: buyer rejected
};

// ---------------------------------------------------------------------------
// Transport Cost Payer (`TRAN_COST_PAYER` field)
// ---------------------------------------------------------------------------

export const RS_TRAN_COST_PAYER: Record<string, string> = {
  '1': 'მყიდველი',   // Buyer pays transport cost
  '2': 'გამყიდველი', // Seller pays transport cost
};

// ---------------------------------------------------------------------------
// Business Status (`SELLER_ST` / `BUYER_ST` field)
// ---------------------------------------------------------------------------

export const RS_SELLER_ST: Record<string, string> = {
  '0': '',         // No special status
  '1': 'მიკრო',   // Micro business
  '2': 'მცირე',   // Small business
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

export function rsTranCostPayerLabel(code: string | null | undefined): string {
  if (!code) return '';
  return RS_TRAN_COST_PAYER[code] ?? code;
}

export function rsSellerStLabel(code: string | null | undefined): string {
  if (!code) return '';
  return RS_SELLER_ST[code] ?? code;
}
