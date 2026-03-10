'use client';

import React, { useEffect, useState } from 'react';
import { CounteragentFormDialog } from '@/components/figma/CounteragentFormDialog';
import validateCounteragentInput from '@/lib/validators/counteragent';

type Candidate = {
  inn: string;
  iban: string | null;
  name: string | null;
  count: number;
  sample: any;
};

export default function MissingCounteragentsPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [entityTypes, setEntityTypes] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [res, etRes, cRes] = await Promise.all([
        fetch('/api/missing-counteragents'),
        fetch('/api/entity-types'),
        fetch('/api/countries')
      ]);
      const body = await res.json();
      const etBody = await etRes.json();
      const cBody = await cRes.json();
      setCandidates(body.data || []);
      setEntityTypes(etBody.data || etBody || []);
      setCountries(cBody.data || cBody || []);
    } catch (err) {
      console.error('Fetch error', err);
      alert('Failed to load missing counteragents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (payload: any) => {
    // payload already matches API shape from CounteragentFormDialog
    const res = await fetch('/api/counteragents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('Failed to create');
    await fetchData();
  };

  const handleBulkSave = async () => {
    if (candidates.length === 0) return;
    if (!confirm(`Save ${candidates.length} candidate(s)?`)) return;

    const defaultEntity = entityTypes?.[0]?.entityTypeUuid ?? null;
    const defaultCountry = countries?.[0]?.countryUuid ?? null;
    const results: { saved: number; skipped: number; errors: any[] } = { saved: 0, skipped: 0, errors: [] };

    for (const c of candidates) {
      const payload = {
        name: c.name || `Counteragent ${c.inn}`,
        identification_number: c.inn,
        iban: c.iban || null,
        entity_type_uuid: defaultEntity,
        country_uuid: defaultCountry,
        is_active: true
      };

      const { valid, errors } = validateCounteragentInput(payload as any, entityTypes || []);
      if (!valid) {
        results.skipped += 1;
        results.errors.push({ candidate: c, errors });
        continue;
      }

      try {
        const res = await fetch('/api/counteragents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
          const text = await res.text();
          console.error('Failed to create candidate', c, text);
          results.errors.push({ candidate: c, errors: { api: text } });
        } else {
          results.saved += 1;
        }
      } catch (err) {
        console.error('Error saving candidate', c, err);
        results.errors.push({ candidate: c, errors: { exception: String(err) } });
      }
    }

    await fetchData();

    let summary = `Bulk save complete. Saved: ${results.saved}. Skipped: ${results.skipped}.`;
    if (results.errors.length > 0) summary += ` See console for details of ${results.errors.length} errors.`;
    alert(summary);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Missing Counteragents</h1>
      <p className="text-sm text-muted-foreground">Candidates derived from raw bank records (INN present, no counteragent record)</p>

      <div className="mt-4 mb-4">
        <button className="btn mr-2" onClick={fetchData} disabled={loading}>Refresh</button>
        <button className="btn-primary" onClick={handleBulkSave} disabled={loading || candidates.length===0}>Save all</button>
      </div>

      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2">INN</th>
            <th className="text-left p-2">IBAN</th>
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Count</th>
            <th className="text-left p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c, idx) => (
            <tr key={`${c.inn}-${idx}`} className="border-t">
              <td className="p-2 align-top">{c.inn}</td>
              <td className="p-2 align-top">{c.iban || '-'}</td>
              <td className="p-2 align-top">{c.name || '-'}</td>
              <td className="p-2 align-top">{c.count}</td>
              <td className="p-2 align-top">
                <button className="btn" onClick={() => setSelected(c)}>Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <CounteragentFormDialog
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          editData={{
            name: selected.name || '',
            identificationNumber: selected.inn,
            iban: selected.iban || ''
          }}
          entityTypes={entityTypes}
          countries={countries}
        />
      )}
    </div>
  );
}
