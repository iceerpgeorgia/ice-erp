'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
            <div className="overflow-auto max-h-[60vh] border rounded">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="px-2 py-1">Type</th>
                    <th className="px-2 py-1">Waybill</th>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Debit</th>
                    <th className="px-2 py-1">Credit</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                    <th className="px-2 py-1">Unit</th>
                    <th className="px-2 py-1 text-right">Qty</th>
                    <th className="px-2 py-1">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.entries.map((entry, index) => (
                    <tr key={index} className="border-t align-top">
                      <td className="px-2 py-1 whitespace-nowrap">{KIND_LABELS[entry.kind]}</td>
                      <td className="px-2 py-1">{entry.docNo}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{entry.date}</td>
                      <td className="px-2 py-1 font-mono whitespace-nowrap">{entry.debit}</td>
                      <td className="px-2 py-1 font-mono whitespace-nowrap">{entry.credit}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{money(entry.amount)}</td>
                      <td className="px-2 py-1">{entry.unit ?? ''}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{entry.quantity ?? ''}</td>
                      <td className="px-2 py-1 max-w-[360px] truncate" title={entry.comment ?? ''}>{entry.comment?.split('\n')[0] ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(preview.totals.problemCounts).map(([problem, n]) => (
                  <span key={problem} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
                    {problem}: <b>{n}</b>
                  </span>
                ))}
              </div>
              <div className="overflow-auto max-h-[60vh] border rounded">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="text-left">
                      <th className="px-2 py-1">Waybill</th>
                      <th className="px-2 py-1">Date</th>
                      <th className="px-2 py-1">Supplier</th>
                      <th className="px-2 py-1">Goods</th>
                      <th className="px-2 py-1 text-right">Amount</th>
                      <th className="px-2 py-1">Account</th>
                      <th className="px-2 py-1">Project</th>
                      <th className="px-2 py-1">Why not exported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.notExported.map((row) => (
                      <tr key={row.itemId} className="border-t align-top">
                        <td className="px-2 py-1">{row.waybillNo}</td>
                        <td className="px-2 py-1 whitespace-nowrap">{row.date}</td>
                        <td className="px-2 py-1">{row.supplier ?? ''}</td>
                        <td className="px-2 py-1 max-w-[280px] truncate" title={row.goodsName ?? ''}>{row.goodsName ?? ''}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{money(row.total)}</td>
                        <td className="px-2 py-1 font-mono">{row.account ?? ''}</td>
                        <td className="px-2 py-1 max-w-[200px] truncate" title={row.project ?? ''}>{row.project ?? ''}</td>
                        <td className="px-2 py-1 text-amber-800">{row.problems.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
