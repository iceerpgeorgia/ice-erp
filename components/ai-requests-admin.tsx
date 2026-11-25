'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type RequestStatus = 'new' | 'in_progress' | 'done' | 'rejected';
type ChangeRequest = {
  id: number;
  type: 'bug' | 'improvement' | 'upgrade';
  language: 'ka' | 'en';
  title: string;
  prompt: string;
  pathname: string | null;
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
  requesterEmail: string | null;
  requesterName: string | null;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<RequestStatus, string> = { new: 'New', in_progress: 'In progress', done: 'Done', rejected: 'Rejected' };
const STATUS_STYLE: Record<RequestStatus, string> = {
  new: 'bg-blue-50 text-blue-800 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
  done: 'bg-green-50 text-green-800 border-green-200',
  rejected: 'bg-muted text-muted-foreground border-border',
};
const TYPE_LABEL = { bug: 'Bug', improvement: 'Improvement', upgrade: 'Upgrade' } as const;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Admin list of requests sent from the AI chat: read the plain-language prompt, copy it for the
// developer, move the request through its statuses and leave a note.
export default function AiRequestsAdmin() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-chat/requests');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Failed to load requests');
      setRequests(body.data);
      // Opened from an email link: /admin/ai-requests?id=12
      const fromLink = Number(new URLSearchParams(window.location.search).get('id'));
      setSelectedId((current) => current ?? (fromLink || body.data[0]?.id || null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => (filter === 'all' ? requests : requests.filter((r) => r.status === filter)), [requests, filter]);
  const selected = requests.find((r) => r.id === selectedId) ?? null;
  useEffect(() => {
    setNote(selected?.adminNote ?? '');
    setCopied(false);
  }, [selected?.id, selected?.adminNote]);

  const save = async (changes: { status?: RequestStatus; adminNote?: string | null }) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-chat/requests/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Failed to save');
      setRequests((current) => current.map((r) => (r.id === selected.id ? { ...r, ...body.data } : r)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const copyPrompt = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.prompt);
    setCopied(true);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: requests.length };
    requests.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [requests]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">AI Chat Requests</h1>
          <p className="mt-1 text-muted-foreground">Bug reports and improvement requests users sent from the AI chat</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'new', 'in_progress', 'done', 'rejected'] as const).map((key) => (
          <Button key={key} size="sm" variant={filter === key ? 'default' : 'outline'} onClick={() => setFilter(key)}>
            {key === 'all' ? 'All' : STATUS_LABEL[key]} ({counts[key] ?? 0})
          </Button>
        ))}
      </div>

      {error && <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="max-h-[70vh] overflow-auto rounded-lg border">
          {loading && requests.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No requests here yet.</div>
          ) : (
            visible.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`block w-full border-b px-4 py-3 text-left last:border-b-0 hover:bg-accent ${r.id === selectedId ? 'bg-accent' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">#{r.id}</span>
                  <span className={`rounded border px-1.5 text-xs ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  <span className="text-xs text-muted-foreground">{TYPE_LABEL[r.type]}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                </div>
                <div className="mt-1 truncate font-medium">{r.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.requesterName || r.requesterEmail || 'Unknown user'}
                  {r.pathname ? ` · ${r.pathname}` : ''}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="rounded-lg border p-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a request to read it.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">
                  #{selected.id} · {TYPE_LABEL[selected.type]} · {selected.language === 'ka' ? 'Georgian' : 'English'} ·{' '}
                  {formatDate(selected.createdAt)} · {selected.requesterName || selected.requesterEmail || 'Unknown user'}
                  {selected.pathname ? ` · ${selected.pathname}` : ''}
                </div>
                <h2 className="mt-1 text-xl font-semibold">{selected.title}</h2>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">Request</span>
                  <Button size="sm" variant="outline" onClick={() => void copyPrompt()}>
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy prompt'}
                  </Button>
                </div>
                <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 text-sm">{selected.prompt}</div>
              </div>

              <div>
                <div className="mb-1 text-sm font-medium">Status</div>
                <div className="flex flex-wrap gap-2">
                  {(['new', 'in_progress', 'done', 'rejected'] as const).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={selected.status === status ? 'default' : 'outline'}
                      disabled={saving || selected.status === status}
                      onClick={() => void save({ status })}
                    >
                      {STATUS_LABEL[status]}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-sm font-medium">Admin note</div>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Visible to admins only" />
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={saving || note === (selected.adminNote ?? '')}
                  onClick={() => void save({ adminNote: note.trim() ? note : null })}
                >
                  Save note
                </Button>
              </div>

              {selected.conversation.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">Conversation ({selected.conversation.length} messages)</summary>
                  <div className="mt-2 max-h-80 space-y-2 overflow-auto">
                    {selected.conversation.map((m, index) => (
                      <div
                        key={index}
                        className={`whitespace-pre-wrap rounded p-2 text-sm ${m.role === 'user' ? 'bg-blue-50' : 'bg-muted/40'}`}
                      >
                        <span className="text-xs font-medium text-muted-foreground">{m.role === 'user' ? 'User' : 'AI'}: </span>
                        {m.content}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
