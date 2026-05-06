import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import crypto from 'crypto';

/**
 * POST /api/payments/attachments/ocr
 * Run OCR on an uploaded file and extract invoice fields.
 * Supports images (JPEG, PNG, GIF, BMP, WebP, TIFF) and PDF.
 * Recognises Georgian (ka) and English (en) text.
 *
 * Auth: GOOGLE_VISION_API_KEY  OR  SERVICE_ACCOUNT_JSON (existing Google credential)
 * If neither is configured the endpoint returns 501.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Georgian month → zero-padded month number
// ─────────────────────────────────────────────────────────────────────────────
const GEORGIAN_MONTHS: Record<string, string> = {
  'იანვარი': '01',  'თებერვალი': '02', 'მარტი': '03',
  'აპრილი': '04',  'მაისი': '05',     'ივნისი': '06',
  'ივლისი': '07',  'აგვისტო': '08',   'სექტემბერი': '09',
  'ოქტომბერი': '10','ნოემბერი': '11',  'დეკემბერი': '12',
};

const ENGLISH_MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03',    april: '04',
  may: '05',     june: '06',     july: '07',      august: '08',
  september: '09',october: '10', november: '11',  december: '12',
  jan: '01',     feb: '02',      mar: '03',       apr: '04',
  jun: '06',     jul: '07',      aug: '08',       sep: '09',
  oct: '10',     nov: '11',      dec: '12',
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getVisionAuth(): Promise<{ type: 'apikey' | 'bearer'; token: string }> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (apiKey) return { type: 'apikey', token: apiKey };

  const saJson = process.env.SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    throw new Error(
      'OCR not configured. Set GOOGLE_VISION_API_KEY or ensure SERVICE_ACCOUNT_JSON has Cloud Vision API access.'
    );
  }

  const creds = JSON.parse(saJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);

  const header  = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss: creds.client_email,
    sub: creds.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-vision',
  })));

  const unsigned = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const sig = base64url(sign.sign(creds.private_key));
  const jwt = `${unsigned}.${sig}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(`Vision API token error: ${(err as any).error_description || tokenRes.status}`);
  }

  const tokenData = await tokenRes.json() as { access_token: string };
  return { type: 'bearer', token: tokenData.access_token };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vision API call
// ─────────────────────────────────────────────────────────────────────────────

async function runVisionOcr(base64Content: string, mimeType: string): Promise<string> {
  const { type, token } = await getVisionAuth();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const keyParam = type === 'apikey' ? `?key=${encodeURIComponent(token)}` : '';
  if (type === 'bearer') headers['Authorization'] = `Bearer ${token}`;

  const isPdf = mimeType === 'application/pdf';

  let url: string;
  let body: object;

  if (isPdf) {
    // files:annotate handles single-page base64 PDFs
    url = `https://vision.googleapis.com/v1/files:annotate${keyParam}`;
    body = {
      requests: [{
        inputConfig: { content: base64Content, mimeType: 'application/pdf' },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['ka', 'en'] },
        pages: [1],
      }],
    };
  } else {
    url = `https://vision.googleapis.com/v1/images:annotate${keyParam}`;
    body = {
      requests: [{
        image: { content: base64Content },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['ka', 'en'] },
      }],
    };
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Vision API error ${res.status}: ${(err as any).error?.message || res.statusText}`);
  }

  const data = await res.json() as any;

  if (isPdf) {
    // PDF response: responses[0].responses[] (one per page)
    const pages: any[] = data.responses?.[0]?.responses ?? [];
    return pages.map((p: any) => p.fullTextAnnotation?.text ?? '').join('\n');
  }

  return data.responses?.[0]?.fullTextAnnotation?.text
    ?? data.responses?.[0]?.textAnnotations?.[0]?.description
    ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice field extraction
// ─────────────────────────────────────────────────────────────────────────────

export interface OcrResult {
  date: string | null;
  invoiceNo: string | null;
  amount: number | null;
  currency: string | null;
  rawText: string;
}

function extractInvoiceFields(text: string): OcrResult {
  let date: string | null = null;
  let invoiceNo: string | null = null;
  let amount: number | null = null;
  let currency: string | null = null;

  // ── Currency ────────────────────────────────────────────────────────
  const currencyMap: Array<[RegExp, string]> = [
    [/\bGEL\b|\bლარი\b|₾/,    'GEL'],
    [/\bUSD\b|\bდოლარი\b|\$/,  'USD'],
    [/\bEUR\b|\bევრო\b|€/,     'EUR'],
    [/\bGBP\b|£/,              'GBP'],
  ];
  for (const [pattern, code] of currencyMap) {
    if (pattern.test(text)) { currency = code; break; }
  }

  // ── Date ────────────────────────────────────────────────────────────
  // dd.mm.yyyy or dd/mm/yyyy
  let m = text.match(/\b(\d{2})[./](\d{2})[./](\d{4})\b/);
  if (m) {
    date = `${m[3]}-${m[2]}-${m[1]}`;
  }

  // yyyy-mm-dd
  if (!date) {
    m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (m) date = `${m[1]}-${m[2]}-${m[3]}`;
  }

  // dd Month yyyy  (Georgian)
  if (!date) {
    const geoPattern = new RegExp(
      `(\\d{1,2})\\s+(${Object.keys(GEORGIAN_MONTHS).join('|')})\\s+(\\d{4})`
    );
    m = text.match(geoPattern);
    if (m) {
      date = `${m[3]}-${GEORGIAN_MONTHS[m[2]]}-${m[1].padStart(2, '0')}`;
    }
  }

  // Month dd, yyyy  (English)
  if (!date) {
    const engMonthKeys = Object.keys(ENGLISH_MONTHS).join('|');
    const engPattern = new RegExp(`(${engMonthKeys})\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i');
    m = text.match(engPattern);
    if (m) {
      const mo = ENGLISH_MONTHS[m[1].toLowerCase()];
      if (mo) date = `${m[3]}-${mo}-${m[2].padStart(2, '0')}`;
    }
  }

  // ── Invoice number ──────────────────────────────────────────────────
  const invoicePatterns = [
    // "Invoice No: INV-001" / "Invoice #001" / "Invoice Number: 001"
    /Invoice\s*(?:No\.?|#|Number)?:?\s*([\w/-]+)/i,
    // Georgian: "ინვოისი N 001" / "ინვოისი №001" / "ანგარიშ-ფაქტურა №001"
    /(?:ინვოისი|ანგარიშ-ფაქტურა)\s*(?:N|№|#)?\s*([\w/-]+)/i,
    // Standalone №/N followed by alphanumeric
    /(?:№|No\.?)\s*([\w/-]+)/i,
    // INV- prefix anywhere
    /\b(INV[-/][\w/-]+)/i,
  ];
  for (const p of invoicePatterns) {
    m = text.match(p);
    if (m) {
      invoiceNo = (m[1] ?? m[0]).trim().replace(/^[:.\s]+|[:.\s]+$/g, '');
      // Reject very short/generic matches
      if (invoiceNo.length >= 1) break;
      invoiceNo = null;
    }
  }

  // ── Amount ──────────────────────────────────────────────────────────
  // Priority: lines that contain total-indicator keywords
  const totalKeywords = [
    'სულ გადასახდელი', 'სულ:', 'ჯამი:', 'სულ ჯამი',
    'grand total', 'total amount', 'amount due', 'total due',
    'total:', 'total', 'net total', 'net amount',
  ];

  const parseAmount = (raw: string): number | null => {
    const clean = raw.replace(/[\s,\u00a0]/g, '');
    const num = parseFloat(clean);
    return !isNaN(num) && num > 0 && num < 1e9 ? num : null;
  };

  for (const kw of totalKeywords) {
    const kwEsc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match keyword then optional chars then a number (possibly with decimals)
    const lineRe = new RegExp(
      `${kwEsc}[^\\n]{0,60}?([\\d][\\d\\s,\u00a0]*(?:\\.\\d{1,2})?)`,
      'i'
    );
    m = text.match(lineRe);
    if (m) {
      const parsed = parseAmount(m[1]);
      if (parsed !== null) { amount = parsed; break; }
    }
  }

  // Fallback: largest number with exactly 2 decimal places
  if (amount === null) {
    const allAmounts: number[] = [];
    const decRe = /\b(\d[\d\s,\u00a0]*\.\d{2})\b/g;
    let dm: RegExpExecArray | null;
    while ((dm = decRe.exec(text)) !== null) {
      const parsed = parseAmount(dm[1]);
      if (parsed !== null) allAmounts.push(parsed);
    }
    if (allAmounts.length > 0) amount = Math.max(...allAmounts);
  }

  return { date, invoiceNo, amount, currency, rawText: text.slice(0, 3000) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/bmp', 'image/webp', 'image/tiff', 'image/tif',
  'application/pdf',
]);

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  // Pre-flight: check credentials exist before doing any work
  const hasApiKey = Boolean(process.env.GOOGLE_VISION_API_KEY);
  const hasSa     = Boolean(process.env.SERVICE_ACCOUNT_JSON);
  if (!hasApiKey && !hasSa) {
    return NextResponse.json(
      { error: 'OCR is not configured on this server. Set GOOGLE_VISION_API_KEY or ensure SERVICE_ACCOUNT_JSON has Cloud Vision API access.' },
      { status: 501 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
    }

    const mimeType = (file.type || '').toLowerCase();
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type "${mimeType}". Supported: JPEG, PNG, GIF, BMP, WebP, TIFF, PDF.` },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    const rawText = await runVisionOcr(base64, mimeType);

    if (!rawText.trim()) {
      return NextResponse.json({
        success: true,
        date: null, invoiceNo: null, amount: null, currency: null, rawText: '',
        message: 'No text detected in the document.',
      });
    }

    const fields = extractInvoiceFields(rawText);
    return NextResponse.json({ success: true, ...fields });

  } catch (error: any) {
    console.error('[OCR] Error:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'OCR processing failed' },
      { status: 500 }
    );
  }
}
