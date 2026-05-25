import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SOAP_URL = 'https://services.rs.ge/WaybillService/WaybillService.asmx';

export async function POST(req: NextRequest) {
  const { requireAuthOrCron, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuthOrCron(req);
  if (isAuthError(auth)) return auth;

  const { getRsCredentialsMap } = await import('@/lib/integrations/rsge/client');
  const credsMap = getRsCredentialsMap();
  if (!credsMap.length) return NextResponse.json({ error: 'No RS credentials' }, { status: 500 });
  const { su, sp } = credsMap[0];

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <get_waybill_units xmlns="http://tempuri.org/">
      <su>${su}</su>
      <sp>${sp}</sp>
    </get_waybill_units>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://tempuri.org/get_waybill_units"' },
    body: envelope,
  });
  const text = await res.text();

  const m = text.match(/<get_waybill_unitsResult[^>]*>([\s\S]*?)<\/get_waybill_unitsResult>/);
  if (!m) return NextResponse.json({ raw_response: text.slice(0, 2000) }, { status: 502 });

  const inner = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  return NextResponse.json({ units_xml: inner });
}
