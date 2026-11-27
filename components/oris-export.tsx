'use client';

import { useMemo, useRef, useState } from 'react';
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
  const [fixing, setFixing] = useState<string | null>(null);

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
                {Object.entries(preview.totals.problemCounts).map(([problem, n]) =>
                  FIXABLE_PROBLEMS.includes(problem) ? (
                    <button
                      key={problem}
                      type="button"
                      onClick={() => setFixing(fixing === problem ? null : problem)}
                      className={`rounded border px-2 py-1 text-amber-900 underline-offset-2 hover:underline ${
                        fixing === problem ? 'border-amber-500 bg-amber-200' : 'border-amber-400 bg-amber-100'
                      }`}
                      title="Fill the missing data from an Excel file"
                    >
                      {problem}: <b>{n}</b> · fill from Excel
                    </button>
                  ) : (
                    <span key={problem} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
                      {problem}: <b>{n}</b>
                    </span>
                  )
                )}
              </div>
              {fixing === SUPPLIER_ORIS_PROBLEM && (
                <SupplierOrisPanel period={preview.period} onDone={() => void load()} />
              )}
              <OrisExportGrid storageKey="oris-export-problems-grid" columns={PROBLEM_COLUMNS} rows={problemRows} defaultSort="waybillNo" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const SUPPLIER_ORIS_PROBLEM = 'Supplier has no ORIS ID';
const FIXABLE_PROBLEMS = [SUPPLIER_ORIS_PROBLEM];

type UploadResult = { updated: number; unchanged: number; skipped: Array<{ row: number; supplier: string; reason: string }> };

/** Download the suppliers without an ORIS ID, fill the ORIS ID column, upload it back. */
function SupplierOrisPanel({ period, onDone }: { period: { from: string; to: string }; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/oris-export/supplier-oris', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Upload failed');
      setResult(body);
      if (body.updated > 0) onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="rounded border border-amber-300 bg-amber-50/50 p-3 text-sm space-y-2">
      <div className="text-muted-foreground">
        1. Download the suppliers of this period that have no ORIS ID. 2. Type each supplier&apos;s ORIS ID in the
        <b> ORIS ID</b> column (leave it empty to skip). 3. Upload the file: the ORIS IDs are saved on the counteragents.
        Suppliers that already have an ORIS ID are not changed.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`/api/oris-export/supplier-oris?from=${period.from}&to=${period.to}`}>Download suppliers (.xlsx)</a>
        </Button>
        <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Uploading…' : 'Upload filled file'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
      {error && <div className="text-red-700">{error}</div>}
      {result && (
        <div className="space-y-1">
          <div>
            Saved <b>{result.updated}</b> ORIS IDs
            {result.unchanged > 0 && <>, {result.unchanged} already had the same ID</>}
            {result.skipped.length > 0 && <>, <b className="text-red-700">{result.skipped.length} not saved</b></>}.
          </div>
          {result.skipped.length > 0 && (
            <ul className="max-h-40 overflow-auto text-xs text-red-700 list-disc pl-5">
              {result.skipped.map((s) => (
                <li key={`${s.row}-${s.reason}`}>
                  Row {s.row}{s.supplier ? ` (${s.supplier})` : ''}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <OrganisationsUpload onDone={onDone} />
    </div>
  );
}

type OrganisationsResult = {
  dryRun: boolean;
  organisations: number;
  applied: number;
  changes: Array<{ counteragent: string; to: string }>;
  unchanged: number;
  differs: Array<{ counteragent: string; current: string; codes: string[] }>;
  ambiguous: Array<{ counteragent: string; codes: string[] }>;
  conflicts: Array<{ counteragent: string; code: string; owner: string }>;
  noCounteragent: Array<{ row: number; code: string; taxId: string; name: string }>;
  noTaxId: Array<{ row: number; code: string; name: string }>;
};

/** Upload the organisations export of ORIS (ORGANISATIONS.XLSX): preview, then save the ORIS IDs. */
function OrganisationsUpload({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OrganisationsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (chosen: File, dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', chosen);
      form.append('dryRun', String(dryRun));
      const res = await fetch('/api/oris-export/organisations', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Upload failed');
      setResult(body);
      if (!dryRun && body.applied > 0) onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="border-t border-amber-300 pt-2 space-y-2">
      <div className="text-muted-foreground">
        Or upload the organisations list exported from ORIS (ORGANISATIONS.XLSX). A row belongs to the counteragent whose tax ID appears
        in it as a whole word, the name in column C first, then column B. A counteragent without an ORIS ID gets the code in column A when exactly one organisation in the file has its
        tax ID; existing ORIS IDs are never changed. You see what will be set before anything is saved.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy && result === null ? 'Reading…' : 'Upload ORIS organisations file'}
        </Button>
        {file && <span className="text-xs text-muted-foreground">{file.name}</span>}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (fileRef.current) fileRef.current.value = '';
            if (!chosen) return;
            setFile(chosen);
            setResult(null);
            void send(chosen, true);
          }}
        />
      </div>
      {error && <div className="text-red-700">{error}</div>}
      {result && (
        <div className="space-y-1">
          {result.dryRun ? (
            <div>
              {result.organisations.toLocaleString('en-US')} organisations in the file. <b>{result.changes.length}</b> counteragents get an ORIS ID;{' '}
              {result.unchanged.toLocaleString('en-US')} already have it.
            </div>
          ) : (
            <div className="text-green-700">
              Saved <b>{result.applied}</b> ORIS IDs.
            </div>
          )}
          <ResultList title="Will be set" show={result.dryRun} items={result.changes.map((c) => `${c.counteragent}: ${c.to}`)} />
          <ResultList
            title="Not changed: the counteragent has another ORIS ID than the file"
            items={result.differs.map((d) => `${d.counteragent}: ${d.current} (file: ${d.codes.join(' / ')})`)}
          />
          <ResultList
            title="Not set: ORIS has several organisations with this tax ID (set it on the Counteragents page)"
            items={result.ambiguous.map((a) => `${a.counteragent}: ${a.codes.join(' / ')}`)}
            warn
          />
          <ResultList
            title="Not set: the code already belongs to a counteragent with another tax ID"
            items={result.conflicts.map((c) => `${c.counteragent}: ${c.code} belongs to ${c.owner}`)}
            warn
          />
          <ResultList
            title="Tax ID has no counteragent"
            items={result.noCounteragent.map((r) => `${r.code} · ${r.taxId} · ${r.name}`)}
          />
          <ResultList title="No tax ID in the row" items={result.noTaxId.map((r) => `${r.code} · ${r.name}`)} />
          {result.dryRun && file && result.changes.length > 0 && (
            <Button size="sm" disabled={busy} onClick={() => void send(file, false)}>
              {busy ? 'Saving…' : `Save ${result.changes.length} ORIS IDs`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ResultList({ title, items, warn, show = true }: { title: string; items: string[]; warn?: boolean; show?: boolean }) {
  if (!show || items.length === 0) return null;
  return (
    <details className="text-xs">
      <summary className={`cursor-pointer ${warn ? 'text-red-700' : ''}`}>
        {title}: <b>{items.length}</b>
      </summary>
      <ul className="max-h-48 overflow-auto list-disc pl-5 mt-1">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </details>
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
