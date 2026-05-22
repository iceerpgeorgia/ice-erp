/**
 * rs.ge WaybillService SOAP client
 *
 * Credentials are read exclusively from environment variables:
 *   RS_API_SU — service user name (e.g. ICEAPI:400017245)
 *   RS_API_SP — service user password
 *
 * Never log or expose these values.
 */

const SOAP_URL = 'https://services.rs.ge/WaybillService/WaybillService.asmx';

export interface GetBuyerWaybillsParams {
  su: string;
  sp: string;
  /**
   * Filter by CREATE_DATE (matches portal's "Activation Period" filter).
   * Both start and end must be provided together.
   */
  createDateS?: Date;
  createDateE?: Date;
  /** Filter by BEGIN_DATE (transport start). Both must be provided together. */
  beginDateS?: Date;
  beginDateE?: Date;
  /** Comma-separated status codes, e.g. "1,2,5" — omit to return all */
  statuses?: string;
  /** Comma-separated waybill type codes — omit to return all */
  itypes?: string;
  /** Filter by seller TIN */
  sellerTin?: string;
  /** Filter by specific waybill number */
  waybillNumber?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toSoapDate(d: Date): string {
  // ISO-8601 without trailing Z — rs.ge expects local datetime strings
  return d.toISOString().slice(0, 19);
}

function buildSoapEnvelope(params: GetBuyerWaybillsParams): string {
  const str = (v?: string) => (v ? escapeXml(v) : '');
  const dt = (v?: Date, tag?: string) =>
    v ? `<${tag}>${toSoapDate(v)}</${tag}>` : `<${tag} xsi:nil="true" />`;

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <get_buyer_waybills xmlns="http://tempuri.org/">
      <su>${str(params.su)}</su>
      <sp>${str(params.sp)}</sp>
      <itypes>${str(params.itypes)}</itypes>
      <seller_tin>${str(params.sellerTin)}</seller_tin>
      <statuses>${str(params.statuses)}</statuses>
      <car_number></car_number>
      ${dt(params.beginDateS, 'begin_date_s')}
      ${dt(params.beginDateE, 'begin_date_e')}
      ${dt(params.createDateS, 'create_date_s')}
      ${dt(params.createDateE, 'create_date_e')}
      <driver_tin></driver_tin>
      <delivery_date_s xsi:nil="true" />
      <delivery_date_e xsi:nil="true" />
      <full_amount xsi:nil="true" />
      <waybill_number>${str(params.waybillNumber)}</waybill_number>
      <close_date_s xsi:nil="true" />
      <close_date_e xsi:nil="true" />
      <s_user_ids></s_user_ids>
      <comment></comment>
    </get_buyer_waybills>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Calls get_buyer_waybills and returns the raw inner XML string
 * (the content of <get_buyer_waybillsResult>).
 *
 * Throws on HTTP or SOAP fault.
 */
export async function getBuyerWaybillsXml(params: GetBuyerWaybillsParams): Promise<string> {
  const envelope = buildSoapEnvelope(params);

  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '"http://tempuri.org/get_buyer_waybills"',
    },
    body: envelope,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`rs.ge HTTP ${res.status}: ${res.statusText}${errBody ? ` — ${errBody.slice(0, 300)}` : ''}`);
  }

  const text = await res.text();

  // SOAP faults arrive as 200 OK with a <faultstring> in the body
  const faultMatch = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/);
  if (faultMatch) {
    throw new Error(`rs.ge SOAP fault: ${faultMatch[1].trim()}`);
  }

  const resultMatch = text.match(
    /<get_buyer_waybillsResult[^>]*>([\s\S]*?)<\/get_buyer_waybillsResult>/,
  );
  if (!resultMatch) {
    throw new Error('Unexpected rs.ge response: missing get_buyer_waybillsResult element');
  }

  // The inner XML is HTML-entity-escaped inside the SOAP envelope
  const innerXml = resultMatch[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  return innerXml;
}

/**
 * Returns credentials from env or throws a descriptive error.
 * Call once per request; do not cache the result in module scope.
 */
export function getRsApiCredentials(): { su: string; sp: string } {
  const su = process.env.RS_API_SU?.trim();
  const sp = process.env.RS_API_SP?.trim();
  if (!su || !sp) {
    throw new Error('RS_API_SU and RS_API_SP environment variables are required');
  }
  return { su, sp };
}

export interface RsCredential {
  insiderUuid: string;
  su: string;
  sp: string;
}

/**
 * Parses RS_CREDENTIALS_MAP env var into per-insider RS API credentials.
 *
 * Format (JSON array, wrapping single-quotes are stripped automatically):
 *   [{"INSIDER_UUID":"...","RS_API_SU":"...","RS_API_SP":"..."}]
 *
 * Falls back to RS_API_SU / RS_API_SP + RS_API_INSIDER_UUID when the map is
 * not set, allowing gradual migration.
 *
 * Returns an empty array when no credentials are configured — cron routes
 * should treat this as a 503 / configuration error.
 */
export function getRsCredentialsMap(): RsCredential[] {
  const raw = (process.env.RS_CREDENTIALS_MAP ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      try {
        parsed = JSON.parse(raw.replace(/\\"/g, '"'));
      } catch {
        parsed = null;
      }
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      const result: RsCredential[] = [];
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue;
        const row = entry as Record<string, unknown>;
        const insiderUuid = String(row.INSIDER_UUID ?? row.insider_uuid ?? '').trim();
        const su = String(row.RS_API_SU ?? row.su ?? '').trim();
        const sp = String(row.RS_API_SP ?? row.sp ?? '').trim();
        if (insiderUuid && su && sp) result.push({ insiderUuid, su, sp });
      }
      if (result.length > 0) return result;
    }
  }

  // Fallback: single credential pair with explicit insider UUID
  const su = (process.env.RS_API_SU ?? '').trim();
  const sp = (process.env.RS_API_SP ?? '').trim();
  const insiderUuid = (process.env.RS_API_INSIDER_UUID ?? '').trim();
  if (su && sp && insiderUuid) return [{ insiderUuid, su, sp }];

  return [];
}

/**
 * Checks whether a given TIN (INN) is registered as a VAT payer at rs.ge.
 *
 * Uses the WaybillService `is_vat_payer_tin` operation — same SOAP endpoint,
 * same credentials. Returns true/false. Throws on network/SOAP error.
 */
export async function isVatPayerTin(su: string, sp: string, tin: string): Promise<boolean> {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <is_vat_payer_tin xmlns="http://tempuri.org/">
      <su>${escapeXml(su)}</su>
      <sp>${escapeXml(sp)}</sp>
      <tin>${escapeXml(tin)}</tin>
    </is_vat_payer_tin>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '"http://tempuri.org/is_vat_payer_tin"',
    },
    body: envelope,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`rs.ge HTTP ${res.status}: ${res.statusText}${errBody ? ` — ${errBody.slice(0, 300)}` : ''}`);
  }

  const text = await res.text();
  const faultMatch = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/);
  if (faultMatch) throw new Error(`rs.ge SOAP fault: ${faultMatch[1].trim()}`);

  const resultMatch = text.match(/<is_vat_payer_tinResult[^>]*>([\s\S]*?)<\/is_vat_payer_tinResult>/);
  if (!resultMatch) throw new Error('Unexpected rs.ge response: missing is_vat_payer_tinResult element');

  return resultMatch[1].trim().toLowerCase() === 'true';
}

/**
 * Batch-checks VAT payer status for a set of TINs.
 * Returns a Map<tin, isVatPayer> for all provided TINs.
 * Unknown/error TINs are omitted from the result.
 */
export async function batchIsVatPayerTin(
  su: string,
  sp: string,
  tins: Iterable<string>,
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  const tinList = [...new Set(tins)].filter(Boolean);
  // Sequential calls — avoid rate-limit issues on the RS API
  for (const tin of tinList) {
    try {
      result.set(tin, await isVatPayerTin(su, sp, tin));
    } catch {
      // Leave unknown TINs out of the map; caller decides the default
    }
  }
  return result;
}
