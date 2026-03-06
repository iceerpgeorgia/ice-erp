'use client';

import { FilterX } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export function ClearFiltersButton({
  onClear,
  activeCount,
  className,
  label = 'Clear Filters',
}: {
  onClear: () => void;
  activeCount: number;
  className?: string;
  label?: string;
}) {
  const normalizedActiveCount = Number.isFinite(activeCount) ? Math.max(0, activeCount) : 0;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClear}
      disabled={normalizedActiveCount === 0}
      className={`gap-2 ${className ?? ''}`.trim()}
    >
      <FilterX className="h-4 w-4" />
      {label}
      {normalizedActiveCount > 0 && (
        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
          {normalizedActiveCount}
        </Badge>
      )}
    </Button>
  );
}
