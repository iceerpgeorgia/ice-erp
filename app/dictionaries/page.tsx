'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { MASTER_NAV, type MasterNavItem } from '@/lib/nav/master';
import { getIcon } from '@/lib/nav/icons';
import { useNavConfig, type NavFolder } from '@/components/nav-config-context';
import { IconPicker } from '@/components/nav-icon-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FolderPlus, Pencil, Trash2, FolderOpen, ExternalLink, GripVertical } from 'lucide-react';

/* ─── Folder drop target chip ─── */

function FolderChip({
  folder, onRename, onIconChange, onDelete, onDrop, isDragActive,
}: {
  folder: NavFolder;
  onRename: (id: string, name: string) => void;
  onIconChange: (id: string, icon: string) => void;
  onDelete: (id: string) => void;
  onDrop: (folderId: string | null) => void;
  isDragActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [over, setOver] = useState(false);
  const Icon = getIcon(folder.icon);

  const save = () => {
    if (name.trim() && name.trim() !== folder.name) onRename(folder.id, name.trim());
    setEditing(false);
  };

  return (
    <>
      <IconPicker open={pickerOpen} current={folder.icon} onSelect={icon => onIconChange(folder.id, icon)} onClose={() => setPickerOpen(false)} />
      <div
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); onDrop(folder.id); }}
        className={cn(
          'flex items-center gap-1 rounded-lg border px-2.5 py-1.5 transition-all',
          over
            ? 'border-primary bg-primary/10 scale-105 shadow-md'
            : isDragActive
            ? 'border-primary/40 bg-primary/5 border-dashed'
            : 'border-border bg-card shadow-xs',
        )}
      >
        <button onClick={() => setPickerOpen(true)} title="Change icon" className="flex items-center justify-center rounded p-0.5 hover:bg-accent transition-colors">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {editing ? (
          <Input value={name} onChange={e => setName(e.target.value)} onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="h-6 w-28 text-xs px-1 py-0" autoFocus />
        ) : (
          <span className="text-xs font-medium text-foreground">{folder.name}</span>
        )}
        <button onClick={() => { setName(folder.name); setEditing(v => !v); }} className="ml-0.5 rounded p-0.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Pencil className="h-3 w-3" />
        </button>
        <button onClick={() => onDelete(folder.id)} className="rounded p-0.5 hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </>
  );
}

/* ─── Default (unassign) drop chip ─── */

function DefaultChip({ onDrop, isDragActive }: { onDrop: () => void; isDragActive: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(); }}
      className={cn(
        'flex items-center gap-1 rounded-lg border px-2.5 py-1.5 transition-all',
        over
          ? 'border-muted-foreground bg-muted scale-105 shadow-md'
          : isDragActive
          ? 'border-muted-foreground/40 bg-muted/40 border-dashed'
          : 'border-border bg-card shadow-xs opacity-50',
      )}
    >
      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">Default</span>
    </div>
  );
}

/* ─── Draggable page card ─── */

function NavItemCard({
  item, iconOverride, folderId, folders, onIconChange, onDragStart,
}: {
  item: MasterNavItem;
  iconOverride: string | null;
  folderId: string | null;
  folders: NavFolder[];
  onIconChange: (routeKey: string, icon: string) => void;
  onDragStart: (routeKey: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const effectiveIcon = iconOverride ?? item.defaultIcon;
  const Icon = getIcon(effectiveIcon);
  const assignedFolder = folders.find(f => f.id === folderId);

  return (
    <>
      <IconPicker open={pickerOpen} current={effectiveIcon} onSelect={icon => onIconChange(item.routeKey, icon)} onClose={() => setPickerOpen(false)} />
      <div
        draggable
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(item.routeKey); setDragging(true); }}
        onDragEnd={() => setDragging(false)}
        className={cn(
          'group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 transition-all cursor-grab active:cursor-grabbing',
          dragging ? 'opacity-40 scale-95' : 'hover:shadow-sm shadow-xs',
        )}
      >
        {/* Drag handle hint */}
        <GripVertical className="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />

        <div className="flex items-start gap-2.5">
          <button onClick={() => setPickerOpen(true)} title="Change icon"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors">
            <Icon className="h-4 w-4 text-foreground" />
          </button>
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-sm font-medium text-foreground leading-tight truncate">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{item.desc}</p>
          </div>
        </div>

        {/* Current folder badge + open link */}
        <div className="flex items-center justify-between gap-1.5">
          <span className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-xs', assignedFolder ? 'bg-primary/10 text-primary' : 'text-muted-foreground/60')}>
            {assignedFolder
              ? <>{(() => { const FI = getIcon(assignedFolder.icon); return <FI className="h-3 w-3 shrink-0" />; })()}<span className="truncate">{assignedFolder.name}</span></>
              : <><FolderOpen className="h-3 w-3 shrink-0" /><span>Default</span></>
            }
          </span>
          <Link href={item.routeKey} title="Open page" onClick={e => e.stopPropagation()}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </>
  );
}

/* ─── Main page ─── */

export default function NavOrganizerPage() {
  const { config, loading, refresh } = useNavConfig();
  const [iconOverrides, setIconOverrides] = useState<Record<string, string | null>>({});
  const [folderAssignments, setFolderAssignments] = useState<Record<string, string | null>>({});
  const [folders, setFolders] = useState<NavFolder[]>([]);
  const [synced, setSynced] = useState(false);
  const [draggedRoute, setDraggedRoute] = useState<string | null>(null);

  if (config && !synced) {
    const icons: Record<string, string | null> = {};
    const assigns: Record<string, string | null> = {};
    config.items.forEach(i => { if (i.icon) icons[i.routeKey] = i.icon; if (i.folderId) assigns[i.routeKey] = i.folderId; });
    setIconOverrides(icons);
    setFolderAssignments(assigns);
    setFolders(config.folders);
    setSynced(true);
  }

  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const res = await fetch('/api/nav/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFolderName.trim(), icon: 'Folder', sortOrder: folders.length }) });
    if (res.ok) { const folder = await res.json(); setFolders(f => [...f, folder]); setNewFolderName(''); setCreatingFolder(false); refresh(); }
  };
  const renameFolder = async (id: string, name: string) => {
    const res = await fetch(`/api/nav/folders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (res.ok) setFolders(f => f.map(folder => folder.id === id ? { ...folder, name } : folder));
  };
  const changeFolderIcon = async (id: string, icon: string) => {
    const res = await fetch(`/api/nav/folders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ icon }) });
    if (res.ok) setFolders(f => f.map(folder => folder.id === id ? { ...folder, icon } : folder));
  };
  const deleteFolder = async (id: string) => {
    const res = await fetch(`/api/nav/folders/${id}`, { method: 'DELETE' });
    if (res.ok) { setFolders(f => f.filter(folder => folder.id !== id)); setFolderAssignments(a => { const n = { ...a }; Object.keys(n).forEach(k => { if (n[k] === id) n[k] = null; }); return n; }); refresh(); }
  };
  const changeItemIcon = async (routeKey: string, icon: string) => {
    setIconOverrides(prev => ({ ...prev, [routeKey]: icon }));
    await fetch('/api/nav/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeKey, icon }) });
    refresh();
  };
  const changeItemFolder = async (routeKey: string, folderId: string | null) => {
    setFolderAssignments(prev => ({ ...prev, [routeKey]: folderId }));
    setDraggedRoute(null);
    await fetch('/api/nav/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeKey, folderId }) });
    refresh();
  };

  const handleDrop = (folderId: string | null) => {
    if (draggedRoute) changeItemFolder(draggedRoute, folderId);
  };

  const defaultGroups = Array.from(new Set(MASTER_NAV.map(i => i.defaultGroup)));
  const isDragActive = draggedRoute !== null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl font-semibold text-foreground">Navigation Organizer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drag pages onto a folder to organize them. Click the icon on any page or folder to change it.
        </p>
      </div>

      {/* Folders row — drop targets */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">My Folders</h2>
          <button onClick={() => setCreatingFolder(v => !v)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <FolderPlus className="h-3.5 w-3.5" />New Folder
          </button>
        </div>
        {creatingFolder && (
          <div className="flex items-center gap-2 mb-3">
            <Input placeholder="Folder name…" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); } }}
              className="h-8 w-48 text-sm" autoFocus />
            <Button size="sm" onClick={createFolder} className="h-8">Create</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="h-8">Cancel</Button>
          </div>
        )}
        {folders.length === 0 && !creatingFolder && (
          <p className="text-sm text-muted-foreground italic">No folders yet. Click "New Folder" to start organizing your sidebar.</p>
        )}
        <div className="flex flex-wrap gap-2 items-center">
          {folders.map(folder => (
            <FolderChip key={folder.id} folder={folder} onRename={renameFolder} onIconChange={changeFolderIcon}
              onDelete={deleteFolder} onDrop={handleDrop} isDragActive={isDragActive} />
          ))}
          {folders.length > 0 && (
            <DefaultChip onDrop={() => handleDrop(null)} isDragActive={isDragActive} />
          )}
        </div>
        {isDragActive && (
          <p className="mt-2 text-xs text-primary animate-pulse">Drop onto a folder above to assign, or onto "Default" to remove from folder</p>
        )}
      </section>

      {/* Page cards — draggable */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : defaultGroups.map(group => {
        const groupItems = MASTER_NAV.filter(i => i.defaultGroup === group);
        return (
          <section key={group}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{group}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {groupItems.map(item => (
                <NavItemCard key={item.routeKey} item={item}
                  iconOverride={iconOverrides[item.routeKey] ?? null}
                  folderId={folderAssignments[item.routeKey] ?? null}
                  folders={folders}
                  onIconChange={changeItemIcon}
                  onDragStart={setDraggedRoute}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
