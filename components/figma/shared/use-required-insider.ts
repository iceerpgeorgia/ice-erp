'use client';

import React from 'react';

type RequiredInsiderResponse = {
  insiderUuid?: string;
  insiderName?: string;
};

export function useRequiredInsiderName(): string {
  const [insiderName, setInsiderName] = React.useState('');

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch('/api/required-insider', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as RequiredInsiderResponse;
        if (!mounted) return;

        const resolved = (json.insiderName || json.insiderUuid || '').trim();
        if (resolved) setInsiderName(resolved);
      } catch {
        // Keep UI silent if endpoint is temporarily unavailable.
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return insiderName;
}
