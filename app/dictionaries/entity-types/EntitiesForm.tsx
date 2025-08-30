"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EntitiesForm() {
  const router = useRouter();
  const [name_en, setNameEn] = useState("");
  const [name_ka, setNameKa] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/entity-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_en, name_ka }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setNameEn(""); setNameKa("");
      setMsg("Saved.");
      router.refresh();
    } catch (err: any) {
      setMsg(err.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border rounded-xl p-4">
      <h2 className="font-semibold mb-3">Add / Update Entity Type</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="block text-sm mb-1">Name (EN)</label>
          <input
            value={name_en}
            onChange={(e) => setNameEn(e.target.value)}
            className="border rounded-md px-3 py-2 w-full"
            placeholder="LTD"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Name (KA)</label>
          <input
            value={name_ka}
            onChange={(e) => setNameKa(e.target.value)}
            className="border rounded-md px-3 py-2 w-full"
            placeholder="შპს"
          />
        </div>
        <button
          disabled={busy}
          className="border rounded-md px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
          type="submit"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {msg && <p className="text-sm text-gray-600">{msg}</p>}
      </form>
      <p className="mt-4 text-xs text-gray-500">
        To bulk-load from Excel, run: <code>npm run import:entity-types</code>
      </p>
    </div>
  );
}
