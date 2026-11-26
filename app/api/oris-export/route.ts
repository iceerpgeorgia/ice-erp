import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { getRequiredInsider } from '@/lib/required-insider';
import { buildEntries, csvRows, type OrisScheme } from '@/lib/oris-export/entries';
import { loadOrisLines } from '@/lib/oris-export/load-lines';

export const revalidate = 0;
export const maxDuration = 60;

const isIsoDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * ORIS accounting export of incoming waybills for a period (waybill activation day, Tbilisi).
 * GET ?from=yyyy-mm-dd&to=yyyy-mm-dd            → preview JSON (entries, lines not exported, totals)
 * GET ?from=…&to=…&format=xlsx                  → the CSV tab as .xlsx, ORIS font (like the sheet)
 * The same lines can be exported any number of times.
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
    const { results, entries } = buildEntries(lines);

    if (searchParams.get('format') === 'xlsx') {
      const sheet = XLSX.utils.aoa_to_sheet(csvRows(entries));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'CSV');
      const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="ORIS_${from}_${to}.xlsx"`,
        },
      });
    }

    const lineCounts: Record<OrisScheme, number> = { goods: 0, expense: 0, project: 0, fixed_asset: 0, none: 0, excluded: 0 };
    for (const result of results) lineCounts[result.scheme] += 1;
    const exportedLines = results.filter((r) => r.problems.length === 0).length;
    const notExported = results
      .filter((r) => r.problems.length > 0)
      .map((r) => ({
        itemId: r.line.itemId,
        waybillNo: r.line.waybillNo,
        date: r.line.date,
        supplier: r.line.supplierName,
        goodsName: r.line.goodsName,
        total: r.line.total,
        account: r.line.account,
        project: r.line.projectName,
        scheme: r.scheme,
        problems: r.problems,
      }));
    const problemCounts: Record<string, number> = {};
    for (const row of notExported) for (const problem of row.problems) problemCounts[problem] = (problemCounts[problem] ?? 0) + 1;

    return NextResponse.json({
      period: { from, to },
      insider: insider.insiderName,
      totals: {
        lines: results.length,
        exportedLines,
        notExportedLines: notExported.length,
        entries: entries.length,
        amount: Math.round(entries.reduce((sum, e) => sum + e.amount, 0) * 100) / 100,
        lineCounts,
        problemCounts,
      },
      entries,
      notExported,
    });
  } catch (error) {
    console.error('[ORIS-EXPORT] Error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Export failed' }, { status: 500 });
  }
}
