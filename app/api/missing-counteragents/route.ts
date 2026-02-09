import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const SOURCE_TABLES = [
  { name: 'GE78BG0000000893486000_BOG_GEL', isTbc: false },
  { name: 'GE65TB7856036050100002_TBC_GEL', isTbc: true },
];

const UNION_SQL = SOURCE_TABLES.map((table) => {
  const a = table.isTbc ? 't' : 'cba';
  return `SELECT ${a}.*, '${table.name}' as source_table, ${table.isTbc ? 'true' : 'false'} as is_tbc FROM "${table.name}" ${a}`;
}).join(' UNION ALL ');

function sanitizeBigInt(value: any): any {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(sanitizeBigInt);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeBigInt(v)]));
  return value;
}

export async function GET(req: NextRequest) {
  try {
    // Build query that derives the relevant INN/name/iban per import logic
    const sql = `SELECT
      coalesce(NULLIF(regexp_replace(CASE WHEN coalesce(sub.account_currency_amount,0) >= 0 THEN sub.docsenderinn ELSE sub.docbenefinn END, '\\D','','g'),'') , NULL) as raw_inn,
      CASE
        WHEN length(regexp_replace(CASE WHEN coalesce(sub.account_currency_amount,0) >= 0 THEN sub.docsenderinn ELSE sub.docbenefinn END, '\\D','','g')) = 10
          THEN '0' || regexp_replace(CASE WHEN coalesce(sub.account_currency_amount,0) >= 0 THEN sub.docsenderinn ELSE sub.docbenefinn END, '\\D','','g')
        ELSE regexp_replace(CASE WHEN coalesce(sub.account_currency_amount,0) >= 0 THEN sub.docsenderinn ELSE sub.docbenefinn END, '\\D','','g')
      END as inn,
      CASE
        WHEN sub.is_tbc THEN sub.partner_name
        WHEN coalesce(sub.account_currency_amount,0) >= 0 THEN sub.docsendername
        ELSE sub.docbenefname
      END as name_candidate,
      coalesce(sub.doccoracct, CASE WHEN coalesce(sub.account_currency_amount,0) >= 0 THEN sub.docsenderacctno ELSE sub.docbenefacctno END) as iban_candidate,
      sub.raw_record_uuid, sub.dockey, sub.entriesid, sub.transaction_date, sub.source_table
    FROM (${UNION_SQL}) sub
    WHERE sub.counteragent_uuid IS NULL
      AND (CASE WHEN coalesce(sub.account_currency_amount,0) >= 0 THEN sub.docsenderinn ELSE sub.docbenefinn END) IS NOT NULL
    `;

    const rows = await prisma.$queryRawUnsafe<any[]>(sql);

    // Group distinct candidates by inn+iban+name
    const map = new Map<string, any>();
    for (const r of rows) {
      const inn = r.inn ? String(r.inn).trim() : null;
      if (!inn) continue;
      const iban = r.iban_candidate ? String(r.iban_candidate).trim() : null;
      const name = r.name_candidate ? String(r.name_candidate).trim() : null;
      const key = `${inn}||${iban || ''}||${name || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          inn,
          iban,
          name,
          count: 0,
          sample: { raw_record_uuid: r.raw_record_uuid, dockey: r.dockey, entriesid: r.entriesid, transaction_date: r.transaction_date, source_table: r.source_table }
        });
      }
      map.get(key).count += 1;
    }

    const data = Array.from(map.values());
    return NextResponse.json(sanitizeBigInt({ data }));
  } catch (error: any) {
    console.error('[GET /api/missing-counteragents] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}
