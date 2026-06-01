// app/page.tsx
"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Landmark,
  Wallet,
  FileBarChart2,
  BookOpen,
  ClipboardList,
  LogIn,
  Loader2,
  Users,
} from "lucide-react";

type InsiderOption = {
  insiderUuid: string;
  insiderName: string;
};

const QUICK_LINKS = [
  {
    label: "Bank Transactions",
    href: "/dictionaries/bank-transactions",
    icon: Landmark,
    description: "Import and process BOG/NBG statements",
  },
  {
    label: "Payments",
    href: "/dictionaries/payments",
    icon: Wallet,
    description: "Manage payment records and ledger",
  },
  {
    label: "Waybills",
    href: "/dictionaries/waybills",
    icon: ClipboardList,
    description: "RS.ge waybill sync and processing",
  },
  {
    label: "Payments Report",
    href: "/dictionaries/payments-report",
    icon: FileBarChart2,
    description: "Financial reporting by project",
  },
  {
    label: "Counteragents",
    href: "/dictionaries/counteragents",
    icon: Users,
    description: "Supplier and client registry",
  },
  {
    label: "Financial Codes",
    href: "/admin/financial-codes",
    icon: BookOpen,
    description: "Chart of accounts configuration",
  },
];

export default function HomePage() {
  const { data: session, status } = useSession();
  const [insiderOptions, setInsiderOptions] = useState<InsiderOption[]>([]);
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
  const [loadingSelection, setLoadingSelection] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    const load = async () => {
      setLoadingSelection(true);
      try {
        const res = await fetch('/api/insider-selection', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        setInsiderOptions(Array.isArray(json?.options) ? json.options : []);
        setSelectedUuids(new Set(Array.isArray(json?.selectedUuids) ? json.selectedUuids : []));
      } finally {
        if (mounted) setLoadingSelection(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [session]);

  const allSelected = useMemo(
    () => insiderOptions.length > 0 && selectedUuids.size === insiderOptions.length,
    [insiderOptions, selectedUuids]
  );

  const toggleInsider = (uuid: string) => {
    setSelectedUuids((prev) => {
      const next = new Set(prev);
      next.has(uuid) ? next.delete(uuid) : next.add(uuid);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSavingSelection(false);
    }
  };

  // ── Not signed in ─────────────────────────────────────────────────────────
  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 mx-auto">
            <span className="text-2xl font-bold text-white">IC</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">ICE ERP</h1>
          <p className="text-sm text-muted-foreground">Financial Management System</p>
        </div>
        <Button onClick={() => signIn("google")} className="gap-2 min-w-[160px]">
          <LogIn className="h-4 w-4" />
          Sign in with Google
        </Button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Signed in ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{session?.user?.email}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {(session?.user as any)?.role ?? 'user'}
        </Badge>
      </div>

      {/* Quick access */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Quick Access
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_LINKS.map(({ label, href, icon: Icon, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-xs hover:shadow-sm hover:border-border-strong transition-all"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 transition-colors">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Insider selection */}
      <section className="rounded-xl border border-border bg-card shadow-xs p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Insider View</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select which insiders to include in insider-filtered tables.
            </p>
          </div>
          {!loadingSelection && insiderOptions.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSelectedUuids(new Set(insiderOptions.map((o) => o.insiderUuid)))}
                className="text-xs text-primary hover:underline"
                type="button"
              >
                All
              </button>
              <span className="text-xs text-muted-foreground">·</span>
              <button
                onClick={() => setSelectedUuids(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground"
                type="button"
              >
                None
              </button>
            </div>
          )}
        </div>

        {loadingSelection ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        ) : insiderOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No insiders configured.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {insiderOptions.map((option) => (
              <label
                key={option.insiderUuid}
                className="flex items-center gap-2.5 cursor-pointer rounded-md px-3 py-2 border border-transparent hover:border-border hover:bg-accent transition-colors"
              >
                <Checkbox
                  checked={selectedUuids.has(option.insiderUuid)}
                  onCheckedChange={() => toggleInsider(option.insiderUuid)}
                />
                <span className="text-sm text-foreground">{option.insiderName}</span>
              </label>
            ))}
          </div>
        )}

        {insiderOptions.length > 0 && (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={saveInsiderSelection}
              disabled={savingSelection}
              className="min-w-[120px]"
            >
              {savingSelection ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {savingSelection ? 'Saving…' : saved ? 'Saved ✓' : 'Save selection'}
            </Button>
            {!allSelected && selectedUuids.size === 0 && (
              <p className="text-xs text-muted-foreground">Saving with none checked = all insiders shown.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
