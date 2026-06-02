'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MASTER_NAV } from '@/lib/nav/master';
import { getIcon } from '@/lib/nav/icons';
import { useNavConfig, type NavFolder } from '@/components/nav-config-context';
import { IconPicker } from '@/components/nav-icon-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FolderPlus, Pencil, Trash2, FolderOpen, ExternalLink, GripVertical, Check, X, Save } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type DragState =
  | { kind: 'folder'; id: string }
  | { kind: 'page'; routeKey: string; fromFolderId: string | null }
  | null;

type DropHint =
  | { type: 'folder'; id: string; pos: 'before' | 'after' }
  | { type: 'page'; routeKey: string; pos: 'before' | 'after' }
  | { type: 'folder-enter'; id: string }
  | { type: 'unassigned' }
  | null;

type PickerTarget =
  | { kind: 'folder'; id: string }
  | { kind: 'page'; routeKey: string }
  | null;

// ─── InlineRename ─────────────────────────────────────────────────────────────

function InlineRename({ value, onSave, onCancel }: {
  value: string; onSave: (v: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(value);
  return (
    <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(name.trim()); if (e.key === 'Escape') onCancel(); }}
        onBlur={() => { if (name.trim()) onSave(name.trim()); else onCancel(); }}
        className="h-6 flex-1 text-sm px-1.5 py-0"
        autoFocus
      />
      <button onClick={() => onSave(name.trim())} className="p-0.5 hover:text-primary transition-colors"><Check className="h-3 w-3" /></button>
      <button onClick={onCancel} className="p-0.5 hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NavOrganizerPage() {
  const { config, loading, refresh } = useNavConfig();

  // Structure state
  const [folders, setFolders] = useState<NavFolder[]>([]);
  const [itemsByFolder, setItemsByFolder] = useState<Record<string, string[]>>({});
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [iconOverrides, setIconOverrides] = useState<Record<string, string | null>>({});
  const [synced, setSynced] = useState(false);

  // UI state
  const [dragging, setDragging] = useState<DragState>(null);
  const [dropHint, setDropHint] = useState<DropHint>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Sync from config on first load ──────────────────────────────────────────

  if (config && !synced) {
    const sortedFolders = [...config.folders].sort((a, b) => a.sortOrder - b.sortOrder);
    const byFolder: Record<string, string[]> = {};
    sortedFolders.forEach(f => { byFolder[f.id] = []; });

    const sortedItems = [...config.items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const assignedSet = new Set<string>();
    const icons: Record<string, string | null> = {};

    sortedItems.forEach(item => {
      if (item.icon) icons[item.routeKey] = item.icon;
      if (item.folderId && byFolder[item.folderId] !== undefined) {
        byFolder[item.folderId].push(item.routeKey);
        assignedSet.add(item.routeKey);
      }
    });

    const unassignedFromConfig = sortedItems.filter(i => !i.folderId).map(i => i.routeKey);
    const inConfig = new Set(config.items.map(i => i.routeKey));
    const notInConfig = MASTER_NAV.map(i => i.routeKey).filter(r => !inConfig.has(r));

    setFolders(sortedFolders);
    setItemsByFolder(byFolder);
    setUnassigned([...unassignedFromConfig, ...notInConfig]);
    setIconOverrides(icons);
    setSynced(true);
  }

  // ── Persistence ───────────────────────────────────────────────────────────────

  const saveStructure = async (
    newFolders: NavFolder[],
    newItemsByFolder: Record<string, string[]>,
    newUnassigned: string[],
  ) => {
    const folderPayload = newFolders.map((f, i) => ({ id: f.id, sortOrder: i }));
    const itemPayload: { routeKey: string; folderId: string | null; sortOrder: number }[] = [];
    newFolders.forEach(f => {
      (newItemsByFolder[f.id] ?? []).forEach((rk, i) => itemPayload.push({ routeKey: rk, folderId: f.id, sortOrder: i }));
    });
    newUnassigned.forEach((rk, i) => itemPayload.push({ routeKey: rk, folderId: null, sortOrder: i }));

    setSaving(true);
    await fetch('/api/nav/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folders: folderPayload, items: itemPayload }),
    });
    setSaving(false);
    setIsDirty(false);
    refresh();
  };

  const handleSave = () => saveStructure(folders, itemsByFolder, unassigned);

  // ── Folder operations ─────────────────────────────────────────────────────────

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const res = await fetch('/api/nav/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim(), icon: 'Folder', sortOrder: folders.length }),
    });
    if (res.ok) {
      const folder = await res.json();
      setFolders(f => [...f, folder]);
      setItemsByFolder(m => ({ ...m, [folder.id]: [] }));
      setNewFolderName('');
      setCreatingFolder(false);
      refresh();
    }
  };

  const renameFolder = async (id: string, name: string) => {
    if (!name) { setEditingFolder(null); return; }
    setEditingFolder(null);
    setFolders(f => f.map(folder => folder.id === id ? { ...folder, name } : folder));
    await fetch(`/api/nav/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    refresh();
  };

  const changeFolderIcon = async (id: string, icon: string) => {
    setFolders(f => f.map(folder => folder.id === id ? { ...folder, icon } : folder));
    await fetch(`/api/nav/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icon }),
    });
    refresh();
  };

  const deleteFolder = async (id: string) => {
    const items = itemsByFolder[id] ?? [];
    const newItemsByFolder = { ...itemsByFolder };
    delete newItemsByFolder[id];
    const newFolders = folders.filter(f => f.id !== id);
    const newUnassigned = [...items, ...unassigned];
    setFolders(newFolders);
    setItemsByFolder(newItemsByFolder);
    setUnassigned(newUnassigned);
    await fetch(`/api/nav/folders/${id}`, { method: 'DELETE' });
    saveStructure(newFolders, newItemsByFolder, newUnassigned);
  };

  const changePageIcon = async (routeKey: string, icon: string) => {
    setIconOverrides(prev => ({ ...prev, [routeKey]: icon }));
    await fetch('/api/nav/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeKey, icon }),
    });
    refresh();
  };

  // ── Drag helpers ──────────────────────────────────────────────────────────────

  const resetDrag = () => { setDragging(null); setDropHint(null); };

  const removeFromSource = (
    rk: string,
    fromFolderId: string | null,
    ibf: Record<string, string[]>,
    una: string[],
  ): { ibf: Record<string, string[]>; una: string[] } => {
    if (fromFolderId === null) return { ibf, una: una.filter(r => r !== rk) };
    return { ibf: { ...ibf, [fromFolderId]: ibf[fromFolderId].filter(r => r !== rk) }, una };
  };

  // ── DnD: Folder reorder ───────────────────────────────────────────────────────

  const onFolderDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragging({ kind: 'folder', id });
  };

  const onFolderHeaderDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragging?.kind === 'folder' && dragging.id !== targetId) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setDropHint({ type: 'folder', id: targetId, pos });
    } else if (dragging?.kind === 'page') {
      setDropHint({ type: 'folder-enter', id: targetId });
    }
  };

  const onFolderHeaderDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragging?.kind === 'folder') {
      const srcId = dragging.id;
      if (srcId === targetId) { resetDrag(); return; }
      const pos = dropHint?.type === 'folder' ? dropHint.pos : 'after';
      const newFolders = folders.filter(f => f.id !== srcId);
      const srcFolder = folders.find(f => f.id === srcId)!;
      const idx = newFolders.findIndex(f => f.id === targetId);
      newFolders.splice(pos === 'before' ? idx : idx + 1, 0, srcFolder);
      setFolders(newFolders);
      setIsDirty(true);
      resetDrag();
    } else if (dragging?.kind === 'page') {
      dropPageIntoFolder(targetId);
    }
  };

  // ── DnD: Page reorder / move ──────────────────────────────────────────────────

  const onPageDragStart = (e: React.DragEvent, routeKey: string, fromFolderId: string | null) => {
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
    setDragging({ kind: 'page', routeKey, fromFolderId });
  };

  const onPageDragOver = (e: React.DragEvent, targetRouteKey: string) => {
    e.preventDefault();
    if (dragging?.kind !== 'page' || dragging.routeKey === targetRouteKey) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropHint({ type: 'page', routeKey: targetRouteKey, pos });
  };

  const onPageDrop = (e: React.DragEvent, targetRouteKey: string, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragging?.kind !== 'page') { resetDrag(); return; }
    const { routeKey: srcRoute, fromFolderId: srcFolder } = dragging;
    if (srcRoute === targetRouteKey) { resetDrag(); return; }

    const pos = dropHint?.type === 'page' ? dropHint.pos : 'after';
    let { ibf, una } = removeFromSource(srcRoute, srcFolder, { ...itemsByFolder }, [...unassigned]);

    if (targetFolderId === null) {
      const idx = una.indexOf(targetRouteKey);
      una.splice(pos === 'before' ? idx : idx + 1, 0, srcRoute);
    } else {
      const arr = [...(ibf[targetFolderId] ?? [])];
      const idx = arr.indexOf(targetRouteKey);
      arr.splice(pos === 'before' ? idx : idx + 1, 0, srcRoute);
      ibf[targetFolderId] = arr;
    }

    setItemsByFolder(ibf);
    setUnassigned(una);
    setIsDirty(true);
    resetDrag();
  };

  const dropPageIntoFolder = (targetFolderId: string) => {
    if (dragging?.kind !== 'page') return;
    const { routeKey: srcRoute, fromFolderId: srcFolder } = dragging;
    if (srcFolder === targetFolderId) { resetDrag(); return; }
    let { ibf, una } = removeFromSource(srcRoute, srcFolder, { ...itemsByFolder }, [...unassigned]);
    ibf[targetFolderId] = [...(ibf[targetFolderId] ?? []), srcRoute];
    setItemsByFolder(ibf);
    setUnassigned(una);
    setIsDirty(true);
    resetDrag();
  };

  const dropPageToUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragging?.kind !== 'page') { resetDrag(); return; }
    const { routeKey: srcRoute, fromFolderId: srcFolder } = dragging;
    if (srcFolder === null) { resetDrag(); return; }
    let { ibf, una } = removeFromSource(srcRoute, srcFolder, { ...itemsByFolder }, [...unassigned]);
    una = [...una, srcRoute];
    setItemsByFolder(ibf);
    setUnassigned(una);
    setIsDirty(true);
    resetDrag();
  };

  // ── Computed ──────────────────────────────────────────────────────────────────

  const currentPickerIcon = pickerTarget
    ? (pickerTarget.kind === 'folder'
        ? (folders.find(f => f.id === pickerTarget.id)?.icon ?? 'Folder')
        : (iconOverrides[pickerTarget.routeKey] ?? MASTER_NAV.find(m => m.routeKey === pickerTarget.routeKey)?.defaultIcon ?? 'File'))
    : 'File';

  const defaultGroups = Array.from(new Set(MASTER_NAV.map(i => i.defaultGroup)));

  // ── Page row renderer ─────────────────────────────────────────────────────────

  const renderPageRow = (routeKey: string, folderId: string | null) => {
    const master = MASTER_NAV.find(i => i.routeKey === routeKey);
    if (!master) return null;
    const Icon = getIcon(iconOverrides[routeKey] ?? master.defaultIcon);
    const isHintBefore = dropHint?.type === 'page' && dropHint.routeKey === routeKey && dropHint.pos === 'before';
    const isHintAfter = dropHint?.type === 'page' && dropHint.routeKey === routeKey && dropHint.pos === 'after';
    const isDraggingThis = dragging?.kind === 'page' && dragging.routeKey === routeKey;

    return (
      <div key={routeKey}>
        {isHintBefore && <div className="h-0.5 bg-primary rounded-full my-0.5 mx-2" />}
        <div
          draggable
          onDragStart={e => onPageDragStart(e, routeKey, folderId)}
          onDragEnd={resetDrag}
          onDragOver={e => onPageDragOver(e, routeKey)}
          onDrop={e => onPageDrop(e, routeKey, folderId)}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-lg group cursor-grab active:cursor-grabbing transition-all select-none',
            isDraggingThis ? 'opacity-40' : 'hover:bg-muted/60',
          )}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0 transition-colors" />
          <button
            onClick={e => { e.stopPropagation(); setPickerTarget({ kind: 'page', routeKey }); }}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent transition-colors shrink-0"
            title="Change icon"
          >
            <Icon className="h-3.5 w-3.5 text-foreground" />
          </button>
          <span className="text-sm text-foreground flex-1 truncate">{master.label}</span>
          <Link
            href={routeKey}
            onClick={e => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
            title="Open page"
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        {isHintAfter && <div className="h-0.5 bg-primary rounded-full my-0.5 mx-2" />}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Global icon picker */}
      {pickerTarget && (
        <IconPicker
          open
          current={currentPickerIcon}
          onSelect={icon => {
            if (pickerTarget.kind === 'folder') changeFolderIcon(pickerTarget.id, icon);
            else changePageIcon(pickerTarget.routeKey, icon);
            setPickerTarget(null);
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}

      {/* Header */}
      <div className="border-b border-border pb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Navigation Organizer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag folders to reorder them. Drag pages to reorder within a folder or move between folders. Click any icon to change it.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {isDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving}
            size="sm"
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-2">

          {/* ── Folder blocks ── */}
          {folders.map(folder => {
            const FolderIcon = getIcon(folder.icon);
            const pages = itemsByFolder[folder.id] ?? [];
            const isDraggingThis = dragging?.kind === 'folder' && dragging.id === folder.id;
            const isFolderHintBefore = dropHint?.type === 'folder' && dropHint.id === folder.id && dropHint.pos === 'before';
            const isFolderHintAfter = dropHint?.type === 'folder' && dropHint.id === folder.id && dropHint.pos === 'after';
            const isFolderEnter = dropHint?.type === 'folder-enter' && dropHint.id === folder.id;

            return (
              <div key={folder.id}>
                {isFolderHintBefore && <div className="h-0.5 bg-primary rounded-full my-1 mx-1" />}
                <div className={cn(
                  'rounded-xl border bg-card transition-all overflow-hidden',
                  isDraggingThis && 'opacity-40',
                  isFolderEnter ? 'border-primary ring-1 ring-primary' : 'border-border',
                )}>
                  {/* Folder header — draggable, drop target for folder reorder + page assignment */}
                  <div
                    draggable
                    onDragStart={e => onFolderDragStart(e, folder.id)}
                    onDragEnd={resetDrag}
                    onDragOver={e => onFolderHeaderDragOver(e, folder.id)}
                    onDragLeave={e => {
                      if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropHint(null);
                    }}
                    onDrop={e => onFolderHeaderDrop(e, folder.id)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-b border-border cursor-grab active:cursor-grabbing select-none"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <button
                      onClick={e => { e.stopPropagation(); setPickerTarget({ kind: 'folder', id: folder.id }); }}
                      className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent transition-colors shrink-0"
                      title="Change folder icon"
                    >
                      <FolderIcon className="h-4 w-4 text-foreground" />
                    </button>
                    {editingFolder === folder.id ? (
                      <InlineRename
                        value={folder.name}
                        onSave={name => renameFolder(folder.id, name)}
                        onCancel={() => setEditingFolder(null)}
                      />
                    ) : (
                      <>
                        <span
                          className="text-sm font-semibold text-foreground flex-1 cursor-text"
                          onClick={e => { e.stopPropagation(); setEditingFolder(folder.id); }}
                          title="Click to rename"
                        >
                          {folder.name}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); setEditingFolder(folder.id); }}
                          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteFolder(folder.id); }}
                          className="p-1 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          title="Delete folder"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Pages inside folder */}
                  <div className="p-2 space-y-0.5">
                    {pages.map(rk => renderPageRow(rk, folder.id))}
                    {pages.length === 0 && (
                      <div
                        onDragOver={e => { e.preventDefault(); if (dragging?.kind === 'page') setDropHint({ type: 'folder-enter', id: folder.id }); }}
                        onDrop={e => { e.preventDefault(); if (dragging?.kind === 'page') dropPageIntoFolder(folder.id); }}
                        className="flex items-center justify-center py-4 rounded-lg border border-dashed border-muted-foreground/20 text-xs text-muted-foreground/60"
                      >
                        Drop a page here
                      </div>
                    )}
                  </div>
                </div>
                {isFolderHintAfter && <div className="h-0.5 bg-primary rounded-full my-1 mx-1" />}
              </div>
            );
          })}

          {/* New folder button */}
          {creatingFolder ? (
            <div className="flex items-center gap-2 px-1 py-1">
              <Input
                placeholder="Folder name…"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); } }}
                className="h-8 w-48 text-sm"
                autoFocus
              />
              <Button size="sm" onClick={createFolder} className="h-8">Create</Button>
              <Button size="sm" variant="ghost" onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="h-8">Cancel</Button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-muted-foreground/25 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </button>
          )}

          {/* ── Default (unassigned) section ── */}
          {unassigned.length > 0 && (
            <div
              onDragOver={e => { e.preventDefault(); if (dragging?.kind === 'page') setDropHint({ type: 'unassigned' }); }}
              onDragLeave={e => { if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropHint(null); }}
              onDrop={dropPageToUnassigned}
              className={cn(
                'rounded-xl border transition-all',
                dropHint?.type === 'unassigned' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border bg-muted/20',
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Default</span>
                <span className="text-xs text-muted-foreground">(unassigned — drag to a folder above to assign)</span>
              </div>
              <div className="p-2 space-y-1">
                {defaultGroups.map(group => {
                  const groupPages = unassigned.filter(rk => MASTER_NAV.find(m => m.routeKey === rk)?.defaultGroup === group);
                  if (!groupPages.length) return null;
                  return (
                    <div key={group}>
                      <p className="px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground/60 uppercase tracking-wide">{group}</p>
                      {groupPages.map(rk => renderPageRow(rk, null))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
