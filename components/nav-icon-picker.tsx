'use client';

import { useState } from 'react';
import { getIcon, ICON_NAMES } from '@/lib/nav/icons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  current: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
};

export function IconPicker({ open, current, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');

  const filtered = ICON_NAMES.filter(n =>
    n.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose Icon</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search icons…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-sm"
          autoFocus
        />
        <div className="grid grid-cols-8 gap-1 max-h-96 overflow-y-auto pt-1 pr-1">
          {filtered.map(name => {
            const Icon = getIcon(name);
            const isSelected = name === current;
            return (
              <button
                key={name}
                title={name}
                onClick={() => { onSelect(name); onClose(); setSearch(''); }}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-md p-1.5 text-xs transition-colors hover:bg-accent',
                  isSelected && 'bg-primary/10 ring-1 ring-primary text-primary'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate w-full text-center text-[9px] text-muted-foreground leading-tight">{name}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
