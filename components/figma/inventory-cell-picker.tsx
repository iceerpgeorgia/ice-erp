'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Input } from './ui/input';

export type InventoryOption = {
  uuid: string;
  label: string;
  // Lower-cased label, prepared once for searching.
  search: string;
};

type InventoryCellPickerProps = {
  valueUuid: string | null | undefined;
  valueLabel: string | null | undefined;
  // Inventories with the item's dimension; null while the background load is still running.
  options: InventoryOption[] | null;
  // Set when the item cannot be bound (for example its unit is not mapped to a dimension).
  disabledReason?: string | null;
  busy?: boolean;
  onSelect: (inventoryUuid: string | null) => void;
};

const ROW_HEIGHT = 32;

// Inline Inventory picker for one Waybill Items row: searchable, virtualised list of the inventories
// that share the item's dimension. Every word typed must appear in the label.
export function InventoryCellPicker({
  valueUuid,
  valueLabel,
  options,
  disabledReason,
  busy,
  onSelect,
}: InventoryCellPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (!options) return [];
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return options;
    return options.filter((option) => words.every((word) => option.search.includes(word)));
  }, [options, query]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    setHighlighted(0);
    virtualizer.scrollToIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const choose = (uuid: string | null) => {
    setOpen(false);
    if (uuid !== (valueUuid ?? null)) onSelect(uuid);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.min(
        Math.max(highlighted + (event.key === 'ArrowDown' ? 1 : -1), 0),
        Math.max(filtered.length - 1, 0)
      );
      setHighlighted(next);
      virtualizer.scrollToIndex(next);
    } else if (event.key === 'Enter' && filtered[highlighted]) {
      event.preventDefault();
      choose(filtered[highlighted].uuid);
    }
  };

  const disabled = Boolean(disabledReason) || busy;

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={disabledReason || valueLabel || 'Choose inventory'}
          className="flex h-7 w-full min-w-0 items-center gap-1 rounded border border-transparent px-1 text-left hover:border-input disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={`min-w-0 flex-1 truncate ${valueLabel ? '' : 'text-muted-foreground'}`}>
            {valueLabel || (disabledReason ? '—' : 'Select…')}
          </span>
          {busy ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-2" align="start">
        <Input
          autoFocus
          value={query}
          placeholder="Search inventory…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          className="mb-2 h-8"
        />
        {valueUuid && (
          <button
            type="button"
            className="mb-1 flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm text-muted-foreground hover:bg-accent"
            onClick={() => choose(null)}
          >
            <X className="h-3 w-3" /> Clear inventory (this item only)
          </button>
        )}
        {!options ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading inventories…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            {options.length === 0 ? 'No inventories with this unit.' : 'No inventory matches the search.'}
          </div>
        ) : (
          <>
            <div ref={listRef} className="max-h-[320px] overflow-auto">
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const option = filtered[virtualRow.index];
                  const isCurrent = option.uuid === valueUuid;
                  return (
                    <button
                      key={option.uuid}
                      type="button"
                      title={option.label}
                      onMouseEnter={() => setHighlighted(virtualRow.index)}
                      onClick={() => choose(option.uuid)}
                      className={`absolute left-0 top-0 w-full truncate rounded px-2 text-left text-sm ${
                        virtualRow.index === highlighted ? 'bg-accent' : ''
                      } ${isCurrent ? 'font-semibold' : ''}`}
                      style={{ height: ROW_HEIGHT, transform: `translateY(${virtualRow.start}px)` }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-2 pt-1 text-xs text-muted-foreground">
              {filtered.length} of {options.length} inventories with this unit
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
