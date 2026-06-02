// Call RS.ge get_waybill_units to get the master unit list
const SOAP_URL = 'https://services.rs.ge/WaybillService/WaybillService.asmx';

// Read credentials from .env.rs.local as fallback
const fs = require('fs');
const envLines = fs.readFileSync('.env.rs.local', 'utf8').split('\n');
const cronLine = envLines.find(l => l.startsWith('CRON_SECRET='));

// Try without credentials first (reference data usually public)
const envelopes = [
  // 1. No credentials
  `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <get_waybill_units xmlns="http://tempuri.org/">
    </get_waybill_units>
  </soap:Body>
</soap:Envelope>`,
];

(async () => {
  for (const envelope of envelopes) {
    const res = await fetch(SOAP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://tempuri.org/get_waybill_units"' },
      body: envelope,
    });
    const text = await res.text();

    // Extract result
    const m = text.match(/<get_waybill_unitsResult[^>]*>([\s\S]*?)<\/get_waybill_unitsResult>/);
    if (m) {
      const inner = m[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
      console.log('=== get_waybill_units response ===\n');
      console.log(inner.trim());
      return;
    }

    // Check for fault
    const fault = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/);
    if (fault) { console.log('FAULT:', fault[1]); }
    else { console.log('Unexpected response:\n', text.slice(0, 600)); }
  }
})();
