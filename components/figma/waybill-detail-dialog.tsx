'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from './ui/checkbox';

const NONE_OPTION_VALUE = '__none__';

type Waybill = {
  id: number;
  waybill_no?: string | null;
  state?: string | null;
  condition?: string | null;
  type?: string | null;
  counteragent_inn?: string | null;
  counteragent_name?: string | null;
  departure_address?: string | null;
  shipping_address?: string | null;
  activation_time?: string | null;
  sum?: string | null;
  rs_id?: string | null;
  project_uuid?: string | null;
};

type WaybillItem = {
  id: number;
  goods_code?: string | null;
  goods_name?: string | null;
  unit?: string | null;
  dimension_name?: string | null;
  quantity?: string | number | null;
  unit_price?: string | number | null;
  total_price?: string | number | null;
  taxation?: string | null;
};

interface Props {
  rsId: string | null;
  onClose: () => void;
}

export function WaybillDetailDialog({ rsId, onClose }: Props) {
  const [waybill, setWaybill] = useState<Waybill | null>(null);
  const [waybillItems, setWaybillItems] = useState<WaybillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Project selector
  const [projects, setProjects] = useState<any[]>([]);
  const [dialogProjectUuid, setDialogProjectUuid] = useState<string | null>(null);
  const [dialogProjectDirty, setDialogProjectDirty] = useState(false);
  const [dialogProjectSaving, setDialogProjectSaving] = useState(false);

  // Similar addresses
  const [similarMatches, setSimilarMatches] = useState<any[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [checkedSimilarIds, setCheckedSimilarIds] = useState<Set<string>>(new Set());
  const [similarApplying, setSimilarApplying] = useState(false);
  const [similarView, setSimilarView] = useState<'waybills' | 'addresses'>('waybills');

  // PDF
  const [pdfLoading, setPdfLoading] = useState(false);

  // Drag
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 });
  const dialogDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Fetch projects once on mount
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((body) => setProjects(Array.isArray(body) ? body : (body.data ?? [])))
      .catch(() => {});
  }, []);

  // Fetch waybill + items when rsId changes
  useEffect(() => {
    if (!rsId) {
      setWaybill(null);
      setWaybillItems([]);
      setSimilarMatches([]);
      setCheckedSimilarIds(new Set());
      setDialogPos({ x: 0, y: 0 });
      return;
    }
    setLoading(true);
    setItemsLoading(true);
    setWaybill(null);
    setWaybillItems([]);
    setSimilarMatches([]);
    setCheckedSimilarIds(new Set());
    setSimilarView('waybills');
    setDialogPos({ x: 0, y: 0 });

    // Fetch waybill metadata
    fetch(`/api/waybills?search=${encodeURIComponent(rsId)}&limit=5`)
      .then((r) => r.json())
      .then((body) => {
        const rows: Waybill[] = body.data ?? [];
        const match = rows.find((w) => w.rs_id === rsId) ?? rows[0] ?? null;
        setWaybill(match);
        setDialogProjectUuid(match?.project_uuid ?? null);
        setDialogProjectDirty(false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch items
    fetch(`/api/waybill-items?rs_id=${encodeURIComponent(rsId)}&limit=500`)
      .then((r) => r.json())
      .then((body) => setWaybillItems(body.data ?? []))
      .catch(() => {})
      .finally(() => setItemsLoading(false));
  }, [rsId]);

  const projectOptions = useMemo(() =>
    projects.map((p: any) => ({
      value: p.project_uuid ?? p.uuid,
      label: p.project_index || p.projectIndex || (p.project_uuid ?? p.uuid),
      keywords: `${p.project_index || p.projectIndex || ''}`.trim(),
    })),
    [projects]
  );

  const projectOptionsWithNone = useMemo(() => ([
    { value: NONE_OPTION_VALUE, label: 'No project', keywords: 'none no clear' },
    ...projectOptions,
  ]), [projectOptions]);

  // Group similar matches by address
  const addressGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of similarMatches) {
      const addr = m.shipping_address || '';
      if (!map.has(addr)) map.set(addr, []);
      map.get(addr)!.push(m);
    }
    return Array.from(map.entries())
      .map(([addr, waybills]) => ({
        address: addr,
        waybills,
        maxConfidence: Math.max(...waybills.map((m) => m.llm_score ?? m.trgm_score ?? 0)),
        checkedCount: waybills.filter((m) => checkedSimilarIds.has(m.rs_id)).length,
      }))
      .sort((a, b) => b.maxConfidence - a.maxConfidence);
  }, [similarMatches, checkedSimilarIds]);

  const fetchSimilarAddresses = useCallback(async (wbRsId: string, projectUuid: string) => {
    setSimilarMatches([]);
    setCheckedSimilarIds(new Set());
    setSimilarLoading(true);
    try {
      const res = await fetch('/api/waybills/similar-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rs_id: wbRsId, project_uuid: projectUuid }),
      });
      const body = await res.json();
      if (res.ok) {
        const matches: any[] = body.candidates ?? [];
        setSimilarMatches(matches);
        const preChecked = new Set<string>(
          matches.filter((m) => (m.llm_score ?? m.trgm_score ?? 0) >= 0.7).map((m) => m.rs_id)
        );
        setCheckedSimilarIds(preChecked);
      }
    } catch (err) {
      console.error('similar-address error', err);
    } finally {
      setSimilarLoading(false);
    }
  }, []);

  const handleDialogProjectChange = useCallback((newProjectUuid: string | null, wb: Waybill) => {
    const resolved = newProjectUuid === NONE_OPTION_VALUE ? null : newProjectUuid;
    setDialogProjectUuid(resolved);
    setDialogProjectDirty(true);
    setSimilarMatches([]);
    setCheckedSimilarIds(new Set());
    if (resolved && wb.rs_id) {
      fetchSimilarAddresses(wb.rs_id, resolved);
    }
  }, [fetchSimilarAddresses]);

  const handleSaveDialog = useCallback(async () => {
    if (!waybill?.id) return;
    setDialogProjectSaving(true);
    try {
      const res = await fetch(`/api/waybills?id=${waybill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_uuid: dialogProjectUuid }),
      });
      const body = await res.json();
      if (res.ok && body?.data) {
        setWaybill((prev) => prev ? { ...prev, project_uuid: dialogProjectUuid } : prev);
        setDialogProjectDirty(false);
      }
      if (checkedSimilarIds.size > 0 && dialogProjectUuid) {
        const idMap = new Map<string, number>();
        similarMatches.forEach((m) => { if (m.rs_id && m.id) idMap.set(m.rs_id, Number(m.id)); });
        const numericIds = Array.from(checkedSimilarIds)
          .map((rid) => idMap.get(rid))
          .filter((id): id is number => id !== undefined);
        if (numericIds.length > 0) {
          setSimilarApplying(true);
          const bulkRes = await fetch('/api/waybills/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: numericIds, project_uuid: dialogProjectUuid }),
          });
          if (bulkRes.ok) {
            setSimilarMatches((prev) => prev.filter((m) => !checkedSimilarIds.has(m.rs_id)));
            setCheckedSimilarIds(new Set());
          }
          setSimilarApplying(false);
        }
      }
    } catch (err) {
      console.error('save error', err);
    } finally {
      setDialogProjectSaving(false);
    }
  }, [waybill, dialogProjectUuid, checkedSimilarIds, similarMatches]);

  const handleDownloadPdf = useCallback(async () => {
    if (!waybill?.rs_id) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/waybills/pdf?rs_id=${encodeURIComponent(waybill.rs_id)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? res.statusText);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `waybill-${waybill.rs_id}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      alert(`PDF download failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPdfLoading(false);
    }
  }, [waybill?.rs_id]);

  const handleDialogDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button,input,select,a')) return;
    e.preventDefault();
    dialogDragRef.current = { startX: e.clientX, startY: e.clientY, originX: dialogPos.x, originY: dialogPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dialogDragRef.current) return;
      setDialogPos({
        x: dialogDragRef.current.originX + ev.clientX - dialogDragRef.current.startX,
        y: dialogDragRef.current.originY + ev.clientY - dialogDragRef.current.startY,
      });
    };
    const onUp = () => {
      dialogDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dialogPos]);

  const isOpen = !!rsId;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="p-0 gap-0 [&>button]:text-white [&>button]:top-3 [&>button]:right-4 flex flex-col"
        style={{
          transform: `translate(calc(-50% + ${dialogPos.x}px), calc(-50% + ${dialogPos.y}px))`,
          resize: 'both',
          overflow: 'hidden',
          minWidth: '640px',
          minHeight: '300px',
          width: '1000px',
          maxWidth: '95vw',
          height: '80vh',
          maxHeight: '95vh',
        }}
      >
        {/* Header bar */}
        <div
          className="bg-[#2e7d7d] text-white px-5 py-3 flex items-center justify-between min-h-[52px] cursor-grab active:cursor-grabbing select-none shrink-0"
          onMouseDown={handleDialogDragStart}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {loading ? (
              <span className="text-white/70 text-sm">იტვირთება...</span>
            ) : (
              <>
                <span className="font-bold text-base tracking-wide">{waybill?.waybill_no || waybill?.rs_id || rsId || ''}</span>
                {waybill?.state && (
                  <span className="bg-white/20 rounded px-2 py-0.5 text-xs font-medium">{waybill.state}</span>
                )}
                {waybill?.condition && (
                  <span className="bg-white/20 rounded px-2 py-0.5 text-xs font-medium">{waybill.condition}</span>
                )}
                {waybill?.type && (
                  <span className="bg-white/10 rounded px-2 py-0.5 text-xs text-white/80">{waybill.type}</span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm shrink-0 ml-4">
            {waybill?.activation_time && (
              <span className="text-white/75">{waybill.activation_time}</span>
            )}
            {waybill?.sum && (
              <span className="font-bold tabular-nums">
                {Number(waybill.sum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾
              </span>
            )}
            {waybill?.rs_id && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="text-white/80 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
                title="Download PDF"
              >
                {pdfLoading ? (
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8l-3-3m3 3l3-3M4 20h16" />
                  </svg>
                )}
                <span className="text-xs">PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Project selector row */}
        <div className="px-5 py-2.5 border-b bg-[#f8fafb] flex items-center gap-3 flex-wrap shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Project</span>
          <div className="w-64">
            <Combobox
              options={projectOptionsWithNone}
              value={dialogProjectUuid ?? NONE_OPTION_VALUE}
              onValueChange={(val) => waybill && handleDialogProjectChange(val, waybill)}
              placeholder="Select project…"
            />
          </div>
          {similarLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Finding similar…</span>
          )}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {(dialogProjectDirty || checkedSimilarIds.size > 0) && (
              <span className="text-xs text-amber-600 font-medium">
                {checkedSimilarIds.size > 0
                  ? `${checkedSimilarIds.size} similar selected`
                  : 'Unsaved changes'}
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveDialog}
              disabled={dialogProjectSaving || similarApplying || (!dialogProjectDirty && checkedSimilarIds.size === 0)}
              className="text-xs bg-[#2e7d7d] hover:bg-[#1d5959] text-white px-3 py-1.5 rounded font-medium disabled:opacity-40 transition-colors"
            >
              {dialogProjectSaving || similarApplying ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Counteragent section */}
        <div className="px-5 py-3 border-b bg-white shrink-0">
          <div className="inline-block bg-[#f59e0b] text-white text-[11px] font-bold px-2 py-0.5 rounded mb-2 uppercase tracking-wide">
            გამყიდველი (გამზხავნი)
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {waybill?.counteragent_inn && (
              <div><span className="text-muted-foreground text-xs">საიდენტ. №:</span> <span className="font-medium">{waybill.counteragent_inn}</span></div>
            )}
            {waybill?.counteragent_name && (
              <div className="font-medium">{waybill.counteragent_name}</div>
            )}
            {waybill?.departure_address && (
              <div><span className="text-muted-foreground text-xs">ტრანსპ. დაწყ.:</span> <span>{waybill.departure_address}</span></div>
            )}
            {waybill?.shipping_address && (
              <div><span className="text-muted-foreground text-xs">ტრანსპ. დასრ.:</span> <span>{waybill.shipping_address}</span></div>
            )}
          </div>
        </div>

        {/* Items table */}
        <DialogTitle className="sr-only">ზედნადები {waybill?.waybill_no}</DialogTitle>
        {itemsLoading || loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">იტვირთება...</div>
        ) : waybillItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">საქონელი ვერ მოიძებნა.</div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#f0f4f4] text-left border-b-2 border-[#2e7d7d]/30">
                  <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-8 text-center">№</th>
                  <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-28">საქ. კოდი</th>
                  <th className="px-3 py-2 font-semibold text-[#2e7d7d]">საქონლის დასახელება</th>
                  <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-24">ბოთ. ერთ.</th>
                  <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-24 text-right">რაოდ.</th>
                  <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-28 text-right">ერთ. ფასი</th>
                  <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-28 text-right">საქ. ფასი</th>
                  <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-28">დაბეგვრა</th>
                </tr>
              </thead>
              <tbody>
                {waybillItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f7fbfb]'}>
                    <td className="px-3 py-1.5 border-b border-gray-100 text-muted-foreground text-center">{idx + 1}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100 text-muted-foreground text-xs truncate" title={item.goods_code ?? undefined}>{item.goods_code || '—'}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100 font-medium" title={item.goods_name ?? undefined}>{item.goods_name}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100">{item.dimension_name || item.unit || '—'}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100 text-right tabular-nums">{item.quantity != null ? Number(item.quantity).toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100 text-right tabular-nums">{item.unit_price != null ? Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100 text-right tabular-nums font-semibold">{item.total_price != null ? Number(item.total_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                    <td className="px-3 py-1.5 border-b border-gray-100 text-muted-foreground text-xs">{item.taxation || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#e8f4f4] border-t-2 border-[#2e7d7d]/30 font-semibold">
                  <td className="px-3 py-2 text-[#2e7d7d] text-xs" colSpan={6}>
                    სულ: {waybillItems.length} დასახელება
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#2e7d7d]">
                    {waybillItems
                      .reduce((sum, item) => sum + (item.total_price != null ? Number(item.total_price) : 0), 0)
                      .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Similar-address suggestions panel */}
        {(similarLoading || similarMatches.length > 0) && (
          <div className="px-5 py-3 border-t bg-[#f0f9f9] shrink-0">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-xs font-semibold text-[#2e7d7d] uppercase tracking-wide">
                Similar delivery addresses — not yet in this project
              </span>
              <div className="flex items-center rounded overflow-hidden border border-[#2e7d7d]/30 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setSimilarView('waybills')}
                  className={`px-2.5 py-1 ${similarView === 'waybills' ? 'bg-[#2e7d7d] text-white' : 'bg-white text-[#2e7d7d] hover:bg-[#e0f2f2]'} transition-colors`}
                >
                  Waybills
                </button>
                <button
                  type="button"
                  onClick={() => setSimilarView('addresses')}
                  className={`px-2.5 py-1 border-l border-[#2e7d7d]/30 ${similarView === 'addresses' ? 'bg-[#2e7d7d] text-white' : 'bg-white text-[#2e7d7d] hover:bg-[#e0f2f2]'} transition-colors`}
                >
                  Addresses
                </button>
              </div>
            </div>
            {similarLoading ? (
              <div className="text-xs text-muted-foreground animate-pulse py-2">Analysing addresses with AI…</div>
            ) : similarView === 'waybills' ? (
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
                {similarMatches.map((match) => {
                  const checked = checkedSimilarIds.has(match.rs_id);
                  const confidence = match.llm_score ?? match.trgm_score ?? 0;
                  const confPct = Math.round(confidence * 100);
                  return (
                    <label
                      key={match.rs_id}
                      className={`flex items-start gap-2.5 cursor-pointer rounded px-2.5 py-1.5 text-xs border transition-colors ${
                        checked ? 'bg-[#e0f2f2] border-[#2e7d7d]/40' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setCheckedSimilarIds((prev) => {
                            const next = new Set(prev);
                            v ? next.add(match.rs_id) : next.delete(match.rs_id);
                            return next;
                          });
                        }}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-[#2e7d7d]">{match.waybill_no || match.rs_id}</span>
                          {match.counteragent_name && (
                            <span className="text-muted-foreground truncate">{match.counteragent_name}</span>
                          )}
                          <span className={`ml-auto shrink-0 font-semibold tabular-nums ${confPct >= 70 ? 'text-emerald-600' : confPct >= 40 ? 'text-amber-500' : 'text-red-400'}`}>
                            {confPct}%
                          </span>
                        </div>
                        <div className="text-muted-foreground truncate mt-0.5">{match.shipping_address}</div>
                        {match.llm_reason && (
                          <div className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{match.llm_reason}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                {addressGroups.map((group) => {
                  const allChecked = group.checkedCount === group.waybills.length;
                  const someChecked = group.checkedCount > 0 && !allChecked;
                  const confPct = Math.round(group.maxConfidence * 100);
                  return (
                    <div key={group.address} className="flex flex-col gap-1">
                      <div
                        className={`flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs border ${
                          allChecked ? 'bg-[#e0f2f2] border-[#2e7d7d]/40'
                            : someChecked ? 'bg-[#f0f9f9] border-[#2e7d7d]/25'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <Checkbox
                          checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                          onCheckedChange={(v) => {
                            setCheckedSimilarIds((prev) => {
                              const next = new Set(prev);
                              if (v) { group.waybills.forEach((m) => next.add(m.rs_id)); }
                              else { group.waybills.forEach((m) => next.delete(m.rs_id)); }
                              return next;
                            });
                          }}
                          className="mt-0 shrink-0"
                        />
                        <div className="flex flex-1 items-center gap-2 min-w-0">
                          <span className="font-semibold text-[#2e7d7d] truncate">{group.address || '—'}</span>
                          <span className="shrink-0 text-muted-foreground ml-auto">
                            {group.waybills.length} waybill{group.waybills.length !== 1 ? 's' : ''}
                          </span>
                          <span className={`shrink-0 font-semibold tabular-nums ${confPct >= 70 ? 'text-emerald-600' : confPct >= 40 ? 'text-amber-500' : 'text-red-400'}`}>
                            {confPct}%
                          </span>
                        </div>
                      </div>
                      {group.waybills.map((match) => {
                        const checked = checkedSimilarIds.has(match.rs_id);
                        const matchConfPct = Math.round((match.llm_score ?? match.trgm_score ?? 0) * 100);
                        return (
                          <label
                            key={match.rs_id}
                            className={`ml-5 flex items-start gap-2.5 cursor-pointer rounded px-2.5 py-1.5 text-xs border transition-colors ${
                              checked ? 'bg-[#e0f2f2] border-[#2e7d7d]/40' : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setCheckedSimilarIds((prev) => {
                                  const next = new Set(prev);
                                  v ? next.add(match.rs_id) : next.delete(match.rs_id);
                                  return next;
                                });
                              }}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-[#2e7d7d]">{match.waybill_no || match.rs_id}</span>
                                {match.counteragent_name && (
                                  <span className="text-muted-foreground truncate">{match.counteragent_name}</span>
                                )}
                                <span className={`ml-auto shrink-0 font-semibold tabular-nums ${matchConfPct >= 70 ? 'text-emerald-600' : matchConfPct >= 40 ? 'text-amber-500' : 'text-red-400'}`}>
                                  {matchConfPct}%
                                </span>
                              </div>
                              {match.llm_reason && (
                                <div className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{match.llm_reason}</div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
