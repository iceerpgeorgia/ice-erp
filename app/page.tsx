// app/page.tsx
"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

type InsiderOption = {
  insiderUuid: string;
  insiderName: string;
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const [insiderOptions, setInsiderOptions] = useState<InsiderOption[]>([]);
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
  const [loadingSelection, setLoadingSelection] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);

  useEffect(() => {
    if (!session) return;

    let mounted = true;
    const loadSelection = async () => {
      setLoadingSelection(true);
      try {
        const res = await fetch('/api/insider-selection', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;

        const options = Array.isArray(json?.options) ? json.options : [];
        const selected = Array.isArray(json?.selectedUuids) ? json.selectedUuids : [];

        setInsiderOptions(options);
        setSelectedUuids(new Set(selected));
      } finally {
        if (mounted) setLoadingSelection(false);
      }
    };

    loadSelection();
    return () => {
      mounted = false;
    };
  }, [session]);

  const allSelected = useMemo(
    () => insiderOptions.length > 0 && selectedUuids.size === insiderOptions.length,
    [insiderOptions, selectedUuids]
  );

  const toggleInsider = (uuid: string) => {
    setSelectedUuids((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  };

  const saveInsiderSelection = async () => {
    setSavingSelection(true);
    try {
      await fetch('/api/insider-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedUuids: Array.from(selectedUuids) }),
      });
    } finally {
      setSavingSelection(false);
    }
  };

  return (
    <main>
      <h1>Next.js + Postgres + Google Sign-In</h1>
      <p className="card">
        Status: <b>{status}</b>
      </p>

      {session ? (
        <div className="card">
          <p>Signed in as <b>{session.user?.email}</b></p>
          <div style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
            <p><b>Insider View Selection</b></p>
            <p style={{ marginTop: 4, marginBottom: 8 }}>
              Select insiders to filter insider-bound tables.
            </p>
            {loadingSelection ? (
              <p>Loading insiders...</p>
            ) : insiderOptions.length === 0 ? (
              <p>No insiders configured.</p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={() => setSelectedUuids(new Set(insiderOptions.map((option) => option.insiderUuid)))}
                    type="button"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setSelectedUuids(new Set())}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
                  {insiderOptions.map((option) => (
                    <label key={option.insiderUuid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={selectedUuids.has(option.insiderUuid)}
                        onChange={() => toggleInsider(option.insiderUuid)}
                      />
                      <span>{option.insiderName}</span>
                    </label>
                  ))}
                </div>
                <button onClick={saveInsiderSelection} type="button" disabled={savingSelection}>
                  {savingSelection ? 'Saving...' : 'Save insider view'}
                </button>
                {!allSelected && selectedUuids.size === 0 ? (
                  <p style={{ marginTop: 8 }}>No insider checked. Saving will fallback to all insiders.</p>
                ) : null}
              </>
            )}
          </div>
          <p><Link href="/dictionaries/bank-transactions-test">Open Bank Transactions Test</Link></p>
          <p><Link href="/dictionaries">Open Dictionaries</Link></p>
          <p><Link href="/voice">Open Voice Commands (Mobile)</Link></p>
          {session.user?.role === 'system_admin' && (
            <p><Link href="/admin/users">Manage Users (Admin)</Link></p>
          )}
          <button onClick={() => signOut()}>Sign out</button>
        </div>
      ) : (
        <div className="card">
          <button onClick={() => signIn("google")}>Sign in with Google</button>
        </div>
      )}
    </main>
  );
}
