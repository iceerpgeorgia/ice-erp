'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OrisExportGrid, type GridColumn } from '@/components/oris-export-grid';

type Entry = {
  kind: 'goods' | 'expense' | 'project_in' | 'project_out' | 'vat';
  docNo: string;
  date: string;
  debit: string;
  credit: string;
  amount: number;
  vat: number;
  unit: string | null;
  quantity: number | null;
  comment: string | null;
  itemIds: string[];
};

type NotExported = {
  itemId: string;
  waybillNo: string;
  date: string;
  supplier: string | null;
  goodsName: string | null;
  total: number;
  account: string | null;
  project: string | null;
  scheme: string;
  problems: string[];
};

type Preview = {
  period: { from: string; to: string };
  insider: string;
  totals: {
    lines: number;
    exportedLines: number;
    notExportedLines: number;
    entries: number;
    amount: number;
    lineCounts: Record<string, number>;
    problemCounts: Record<string, number>;
  };
  entries: Entry[];
  notExported: NotExported[];
};

const KIND_LABELS: Record<Entry['kind'], string> = {
  goods: 'Goods',
  expense: 'Expense',
  project_in: 'Project: into stock',
  project_out: 'Project: to project',
  vat: 'VAT',
};

const SCHEME_LABELS: Record<string, string> = {
  goods: 'Goods (account set)',
  expense: 'Expense (account 7…)',
  project: 'Project cost',
  fixed_asset: 'Fixed asset (2…), not exported',
  none: 'No account and no project',
  excluded: 'Left out (cancelled, own, return, zero)',
};

const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyCell = (value: any) => (typeof value === 'number' ? money(value) : '');
// Dates are kept as yyyy-mm-dd in the grid rows so they sort right, and shown as dd.mm.yyyy.
const toIso = (date: string) => date.split('.').reverse().join('-');
const showDate = (value: any) => (typeof value === 'string' && value ? value.split('-').reverse().join('.') : '');

type EntryRow = {
  kind: string; docNo: string; date: string; debit: string; credit: string;
  amount: number; vat: number; unit: string; quantity: number | null; comment: string; fullComment: string;
};
const ENTRY_COLUMNS: GridColumn<keyof EntryRow & string>[] = [
  { key: 'kind', label: 'Type', width: 140 },
  { key: 'docNo', label: 'Waybill', width: 100 },
  { key: 'date', label: 'Date', width: 95, render: showDate },
  { key: 'debit', label: 'Debit', width: 140, mono: true },
  { key: 'credit', label: 'Credit', width: 140, mono: true },
  { key: 'amount', label: 'Amount', width: 100, format: 'number', align: 'right', render: moneyCell },
  { key: 'vat', label: 'VAT part', width: 85, format: 'number', align: 'right', render: moneyCell },
  { key: 'unit', label: 'Unit', width: 80 },
  { key: 'quantity', label: 'Qty', width: 70, format: 'number', align: 'right' },
  { key: 'comment', label: 'Comment', width: 360 },
];

type ProblemRow = {
  waybillNo: string; date: string; supplier: string; goodsName: string; total: number;
  account: string; project: string; scheme: string; reason: string;
};
const PROBLEM_COLUMNS: GridColumn<keyof ProblemRow & string>[] = [
  { key: 'waybillNo', label: 'Waybill', width: 100 },
  { key: 'date', label: 'Date', width: 95, render: showDate },
  { key: 'supplier', label: 'Supplier', width: 180 },
  { key: 'goodsName', label: 'Goods', width: 260 },
  { key: 'total', label: 'Amount', width: 100, format: 'number', align: 'right', render: moneyCell },
  { key: 'account', label: 'Account', width: 90, mono: true },
  { key: 'project', label: 'Project', width: 200 },
  { key: 'scheme', label: 'Kind', width: 170 },
  { key: 'reason', label: 'Why not exported', width: 280 },
];

function previousMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(first), to: iso(last) };
}

export function OrisExport() {
  const initial = useMemo(previousMonth, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'entries' | 'problems'>('entries');

  const query = `from=${from}&to=${to}`;

  const entryRows = useMemo<EntryRow[]>(
    () =>
      (preview?.entries ?? []).map((e) => ({
        kind: KIND_LABELS[e.kind],
        docNo: e.docNo,
        date: toIso(e.date),
        debit: e.debit,
        credit: e.credit,
        amount: e.amount,
        vat: e.vat,
        unit: e.unit ?? '',
        quantity: e.quantity,
        comment: e.comment?.split('\n')[0] ?? '',
        fullComment: e.comment ?? '',
      })),
    [preview]
  );
  const problemRows = useMemo<ProblemRow[]>(
    () =>
      (preview?.notExported ?? []).map((r) => ({
        waybillNo: r.waybillNo,
        date: toIso(r.date),
        supplier: r.supplier ?? '',
        goodsName: r.goodsName ?? '',
        total: r.total,
        account: r.account ?? '',
        project: r.project ?? '',
        scheme: SCHEME_LABELS[r.scheme] ?? r.scheme,
        reason: r.problems.join('; '),
      })),
    [preview]
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/oris-export?${query}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load the export');
      setPreview(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-muted-foreground mb-1">From (activation date)</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </label>
        <label className="text-sm">
          <span className="block text-muted-foreground mb-1">To</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </label>
        <Button onClick={() => void load()} disabled={loading || !from || !to}>
          {loading ? 'Loading…' : 'Preview'}
        </Button>
        {preview && preview.totals.entries > 0 ? (
          <Button asChild variant="outline">
            <a href={`/api/oris-export?from=${preview.period.from}&to=${preview.period.to}&format=xlsx`}>Download for ORIS (.xlsx)</a>
          </Button>
        ) : (
          <Button variant="outline" disabled>Download for ORIS (.xlsx)</Button>
        )}
      </div>

      {error && <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {preview && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Waybill lines in period" value={preview.totals.lines} />
            <Stat label="Lines exported" value={preview.totals.exportedLines} />
            <Stat label="Lines not exported" value={preview.totals.notExportedLines} warn={preview.totals.notExportedLines > 0} />
            <Stat label={`Entries (total ${money(preview.totals.amount)} GEL)`} value={preview.totals.entries} />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(preview.totals.lineCounts)
              .filter(([, n]) => n > 0)
              .map(([scheme, n]) => (
                <span key={scheme} className="rounded border px-2 py-1">
                  {SCHEME_LABELS[scheme] ?? scheme}: <b>{n}</b>
                </span>
              ))}
          </div>

          <div className="flex gap-2 border-b">
            <TabButton active={tab === 'entries'} onClick={() => setTab('entries')}>Entries ({preview.entries.length})</TabButton>
            <TabButton active={tab === 'problems'} onClick={() => setTab('problems')}>Not exported ({preview.notExported.length})</TabButton>
          </div>

          {tab === 'entries' ? (
            <OrisExportGrid
              storageKey="oris-export-entries-grid"
              columns={ENTRY_COLUMNS}
              rows={entryRows}
              defaultSort="docNo"
              rowTitle={(row) => row.fullComment || undefined}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(preview.totals.problemCounts).map(([problem, n]) => (
                  <span key={problem} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
                    {problem}: <b>{n}</b>
                  </span>
                ))}
              </div>
              <OrisExportGrid storageKey="oris-export-problems-grid" columns={PROBLEM_COLUMNS} rows={problemRows} defaultSort="waybillNo" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded border px-3 py-2 ${warn ? 'border-amber-300 bg-amber-50' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value.toLocaleString('en-US')}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${active ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
    >
      {children}
    </button>
  );
}
