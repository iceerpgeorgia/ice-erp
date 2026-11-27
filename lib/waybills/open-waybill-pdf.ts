/**
 * Opens a waybill's PDF from RS.ge in a new browser tab (Waybills and Waybill Items pages).
 * /api/waybills/pdf returns the file inline, so the browser shows it instead of downloading it, and
 * the tab keeps the app address: reloading it fetches the PDF again.
 */
export function openWaybillPdf(rsId: string) {
  window.open(`/api/waybills/pdf?rs_id=${encodeURIComponent(rsId)}`, '_blank', 'noopener');
}
