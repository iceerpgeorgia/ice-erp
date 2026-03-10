'use client';

import React from 'react';
import { Badge } from '../ui/badge';

type RequiredInsider = {
  insiderUuid: string;
  insiderName: string;
};

export function RequiredInsiderBadge({ className = '' }: { className?: string }) {
  const [data, setData] = React.useState<RequiredInsider | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/required-insider', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json?.insiderUuid) {
          setData({ insiderUuid: json.insiderUuid, insiderName: json.insiderName || json.insiderUuid });
        }
      } catch {
        // Keep UI silent if endpoint is temporarily unavailable.
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (!data) return null;

  return (
    <Badge variant="outline" className={className}>
      Insider: {data.insiderName}
    </Badge>
  );
}
