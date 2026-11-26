import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { getRequiredInsider } from '@/lib/required-insider';
import { logAudit } from '@/lib/audit';
import { classifyLine } from '@/lib/oris-export/entries';
import { loadOrisLines } from '@/lib/oris-export/load-lines';

export const revalidate = 0;
export const maxDuration = 60;

const isIsoDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Column headers of the file. The upload finds the columns by these names, so people may add,
// remove or reorder other columns.
const COL_SUPPLIER = 'Supplier';
const COL_UUID = 'Counteragent UUID';
const COL_LINES = 'Lines';
const COL_AMOUNT = 'Amount';
const COL_ORIS = 'ORIS ID';

/**
 * Suppliers whose waybill lines in the ORIS export are held back for "Supplier has no ORIS ID".
 * GET ?from=yyyy-mm-dd&to=yyyy-mm-dd → .xlsx: supplier label, counteragent UUID, lines, amount, empty ORIS ID column.
 * POST (multipart, field "file")     → writes the filled ORIS IDs to counteragents.oris_id.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    return NextResponse.json({ error: 'Give a valid period: from and to as yyyy-mm-dd' }, { status: 400 });
  }

  try {
    const insider = await getRequiredInsider();
    const lines = await loadOrisLines(insider.insiderUuid, from, to);
    const suppliers = new Map<string, { label: string; lines: number; amount: number }>();
    for (const line of lines) {
      const { problems } = classifyLine(line);
      if (!problems.includes('Supplier has no ORIS ID') || !line.supplierUuid) continue;
      const current = suppliers.get(line.supplierUuid) ?? {
        label: line.supplierLabel || line.supplierName || '',
        lines: 0,
        amount: 0,
      };
      current.lines += 1;
      current.amount += line.total;
      suppliers.set(line.supplierUuid, current);
    }

    const rows = Array.from(suppliers.entries())
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([uuid, s]) => ({
        [COL_SUPPLIER]: s.label,
        [COL_UUID]: uuid,
        [COL_LINES]: s.lines,
        [COL_AMOUNT]: Math.round(s.amount * 100) / 100,
        [COL_ORIS]: '',
      }));
    const sheet = XLSX.utils.json_to_sheet(rows, { header: [COL_SUPPLIER, COL_UUID, COL_LINES, COL_AMOUNT, COL_ORIS] });
    sheet['!cols'] = [{ wch: 60 }, { wch: 38 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Suppliers');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Suppliers_without_ORIS_ID_${from}_${to}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[ORIS-EXPORT] Supplier ORIS template failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Download failed' }, { status: 500 });
  }
}

type Skipped = { row: number; supplier: string; reason: string };

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'Choose an Excel file' }, { status: 400 });

    const book = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    const sheet = book.Sheets[book.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
    if (rows.length === 0 || !(COL_UUID in rows[0]) || !(COL_ORIS in rows[0])) {
      return NextResponse.json(
        { error: `The file needs the columns "${COL_UUID}" and "${COL_ORIS}" (use the downloaded file).` },
        { status: 400 }
      );
    }

    const skipped: Skipped[] = [];
    const wanted = new Map<string, { row: number; supplier: string; oris: string }>();
    rows.forEach((r, index) => {
      const row = index + 2; // Excel row number (row 1 is the header)
      const supplier = String(r[COL_SUPPLIER] ?? '').trim();
      const uuid = String(r[COL_UUID] ?? '').trim().toLowerCase();
      const oris = String(r[COL_ORIS] ?? '').trim();
      if (!oris) return; // left empty: nothing to fill
      if (!UUID_RE.test(uuid)) return skipped.push({ row, supplier, reason: 'No valid counteragent UUID' });
      if (!/^\d+$/.test(oris)) return skipped.push({ row, supplier, reason: `ORIS ID "${oris}" is not a number` });
      const earlier = wanted.get(uuid);
      if (earlier && earlier.oris !== oris) {
        return skipped.push({ row, supplier, reason: `Same supplier given two ORIS IDs (${earlier.oris} in row ${earlier.row})` });
      }
      wanted.set(uuid, { row, supplier, oris });
    });

    // The same ORIS ID given to two suppliers in the file.
    const byOris = new Map<string, string[]>();
    wanted.forEach((w, uuid) => byOris.set(w.oris, [...(byOris.get(w.oris) ?? []), uuid]));
    byOris.forEach((uuids, oris) => {
      if (uuids.length < 2) return;
      for (const uuid of uuids) {
        const w = wanted.get(uuid)!;
        skipped.push({ row: w.row, supplier: w.supplier, reason: `ORIS ID ${oris} is given to ${uuids.length} suppliers in the file` });
        wanted.delete(uuid);
      }
    });

    const uuids = Array.from(wanted.keys());
    const existing = uuids.length
      ? await prisma.counteragents.findMany({
          where: { counteragent_uuid: { in: uuids } },
          select: { id: true, counteragent_uuid: true, counteragent: true, name: true, oris_id: true },
        })
      : [];
    const byUuid = new Map(existing.map((c) => [c.counteragent_uuid.toLowerCase(), c]));
    const orisValues = Array.from(new Set(Array.from(wanted.values()).map((w) => w.oris)));
    const taken = orisValues.length
      ? await prisma.$queryRawUnsafe<Array<{ oris: string; counteragent_uuid: string; label: string | null }>>(
          `SELECT btrim(oris_id) AS oris, counteragent_uuid::text AS counteragent_uuid, coalesce(counteragent, name) AS label
             FROM counteragents WHERE btrim(oris_id) = ANY($1::text[])`,
          orisValues
        )
      : [];

    let updated = 0;
    let unchanged = 0;
    for (const [uuid, w] of wanted) {
      const counteragent = byUuid.get(uuid);
      if (!counteragent) {
        skipped.push({ row: w.row, supplier: w.supplier, reason: 'Counteragent not found' });
        continue;
      }
      const current = counteragent.oris_id?.trim() || null;
      if (current === w.oris) {
        unchanged += 1;
        continue;
      }
      if (current) {
        skipped.push({ row: w.row, supplier: w.supplier, reason: `Already has ORIS ID ${current}; change it on the Counteragents page` });
        continue;
      }
      const owner = taken.find((t) => t.oris === w.oris && t.counteragent_uuid.toLowerCase() !== uuid);
      if (owner) {
        skipped.push({ row: w.row, supplier: w.supplier, reason: `ORIS ID ${w.oris} already belongs to ${owner.label ?? owner.counteragent_uuid}` });
        continue;
      }
      await prisma.counteragents.update({ where: { id: counteragent.id }, data: { oris_id: w.oris } });
      await logAudit({ table: 'counteragents', recordId: counteragent.id, action: 'update', changes: { oris_id: { from: null, to: w.oris } } });
      updated += 1;
    }

    skipped.sort((a, b) => a.row - b.row);
    return NextResponse.json({ updated, unchanged, skipped });
  } catch (error) {
    console.error('[ORIS-EXPORT] Supplier ORIS upload failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}
