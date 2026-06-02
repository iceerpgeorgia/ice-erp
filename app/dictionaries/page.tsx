'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MASTER_NAV, type MasterNavItem } from '@/lib/nav/master';
import { getIcon } from '@/lib/nav/icons';
import { useNavConfig, type NavFolder } from '@/components/nav-config-context';
import { IconPicker } from '@/components/nav-icon-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  FolderPlus, Pencil, Trash2, ChevronDown, FolderOpen, ExternalLink, Check,
} from 'lucide-react';

function FolderChip({
  folder,
  onRename,
  onIconChange,
  onDelete,
}: {
  folder: NavFolder;
  onRename: (id: string, name: string) => void;
  onIconChange: (id: string, icon: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [pickerOpen, setPickerOpen] = useState(false);
  const Icon = getIcon(folder.icon);

  const save = () => {
    if (name.trim() && name.trim() !== folder.name) onRename(folder.id, name.trim());
    setEditing(false);
  };

  return (
    <>
      <IconPicker open={pickerOpen} current={folder.icon} onSelect={icon => onIconChange(folder.id, icon)} onClose={() => setPickerOpen(false)} />
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-xs">
        <button onClick={() => setPickerOpen(true)} title="Change icon" className="flex items-center justify-center rounded p-0.5 hover:bg-accent transition-colors">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {editing ? (
          <Input value={name} onChange={e => setName(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} className="h-6 w-28 text-xs px-1 py-0" autoFocus />
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

function NavItemCard({
  item, iconOverride, folderId, folders, onIconChange, onFolderChange,
}: {
  item: MasterNavItem;
  iconOverride: string | null;
  folderId: string | null;
  folders: NavFolder[];
  onIconChange: (routeKey: string, icon: string) => void;
  onFolderChange: (routeKey: string, folderId: string | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const effectiveIcon = iconOverride ?? item.defaultIcon;
  const Icon = getIcon(effectiveIcon);
  const assignedFolder = folders.find(f => f.id === folderId);

  return (
    <>
      <IconPicker open={pickerOpen} current={effectiveIcon} onSelect={icon => onIconChange(item.routeKey, icon)} onClose={() => setPickerOpen(false)} />
      <div className="group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 shadow-xs hover:shadow-sm transition-all">
        <div className="flex items-start gap-2.5">
          <button onClick={() => setPickerOpen(true)} title="Change icon" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors">
            <Icon className="h-4 w-4 text-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground leading-tight truncate">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{item.desc}</p>
          </div>
          <Link href={item.routeKey} title="Open page" className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors w-full text-left', assignedFolder ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-muted-foreground hover:bg-muted')}>
              {assignedFolder ? (
                <>{(() => { const FI = getIcon(assignedFolder.icon); return <FI className="h-3 w-3 shrink-0" />; })()}<span className="truncate flex-1">{assignedFolder.name}</span></>
              ) : (
                <><FolderOpen className="h-3 w-3 shrink-0" /><span className="flex-1 text-muted-foreground">Default group</span></>
              )}
              <ChevronDown className="h-3 w-3 shrink-0 ml-auto" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => onFolderChange(item.routeKey, null)}>
              <FolderOpen className="h-3.5 w-3.5 mr-2 text-muted-foreground" />Default group
              {!folderId && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
            </DropdownMenuItem>
            {folders.length > 0 && <DropdownMenuSeparator />}
            {folders.map(f => {
              const FI = getIcon(f.icon);
              return (
                <DropdownMenuItem key={f.id} onClick={() => onFolderChange(item.routeKey, f.id)}>
                  <FI className="h-3.5 w-3.5 mr-2 text-muted-foreground" />{f.name}
                  {folderId === f.id && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

export default function NavOrganizerPage() {
  const { config, loading, refresh } = useNavConfig();
  const [iconOverrides, setIconOverrides] = useState<Record<string, string | null>>({});
  const [folderAssignments, setFolderAssignments] = useState<Record<string, string | null>>({});
  const [folders, setFolders] = useState<NavFolder[]>([]);
  const [synced, setSynced] = useState(false);

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
    await fetch('/api/nav/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeKey, folderId }) });
    refresh();
  };

  const defaultGroups = Array.from(new Set(MASTER_NAV.map(i => i.defaultGroup)));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl font-semibold text-foreground">Navigation Organizer</h1>
        <p className="text-sm text-muted-foreground mt-1">Customize icons, create folders, and organize pages in the sidebar.</p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">My Folders</h2>
          <button onClick={() => setCreatingFolder(v => !v)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <FolderPlus className="h-3.5 w-3.5" />New Folder
          </button>
        </div>
        {creatingFolder && (
          <div className="flex items-center gap-2 mb-3">
            <Input placeholder="Folder name…" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); } }} className="h-8 w-48 text-sm" autoFocus />
            <Button size="sm" onClick={createFolder} className="h-8">Create</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="h-8">Cancel</Button>
          </div>
        )}
        {folders.length === 0 && !creatingFolder && (
          <p className="text-sm text-muted-foreground italic">No folders yet. Click "New Folder" to start organizing your sidebar.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {folders.map(folder => (
            <FolderChip key={folder.id} folder={folder} onRename={renameFolder} onIconChange={changeFolderIcon} onDelete={deleteFolder} />
          ))}
        </div>
      </section>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : defaultGroups.map(group => {
        const groupItems = MASTER_NAV.filter(i => i.defaultGroup === group);
        return (
          <section key={group}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{group}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {groupItems.map(item => (
                <NavItemCard key={item.routeKey} item={item} iconOverride={iconOverrides[item.routeKey] ?? null} folderId={folderAssignments[item.routeKey] ?? null} folders={folders} onIconChange={changeItemIcon} onFolderChange={changeItemFolder} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
