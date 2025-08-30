# scripts/apply-counteragents-form-layout.ps1
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $dir = Split-Path $Path
  if ($dir) { New-Item -ItemType Directory -Force $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

$tsx = @'
import { PrismaClient } from "@prisma/client";
export const revalidate = 0;

type Opt = { id: string; label: string };

const prisma = new PrismaClient();

export default async function NewCounteragentPage() {
  const [entityTypes, countries] = await Promise.all([
    prisma.entityType.findMany({
      select: { entity_type_uuid: true, name_ka: true },
      orderBy: { name_ka: "asc" },
    }),
    prisma.country.findMany({
      select: { country_uuid: true, country: true },
      orderBy: { country: "asc" },
    }),
  ]);

  const entityOptions: Opt[] = entityTypes.map(e => ({
    id: e.entity_type_uuid,
    label: e.name_ka,
  }));
  const countryOptions: Opt[] = countries.map(c => ({
    id: c.country_uuid,
    label: c.country,
  }));

  return <ClientForm entityOptions={entityOptions} countryOptions={countryOptions} />;
}

/* ----------------------------- client form ----------------------------- */
"use client";
import React from "react";
import { useRouter } from "next/navigation";

type ClientProps = { entityOptions: Opt[]; countryOptions: Opt[] };

const UUIDS = {
  ID_NOT_REQUIRED: new Set([
    "f5c3c745-eaa4-4e27-a73b-badc9ebb49c0",
    "7766e9c2-0094-4090-adf4-ef017062457f",
  ]),
  SEX_REQUIRED: new Set([
    "bf4d83f9-5064-4958-af6e-e4c21b2e4880",
    "5747f8e6-a8a6-4a23-91cc-c427c3a22597",
    "ba538574-e93f-4ce8-a780-667b61fc970a",
  ]),
  PENSION_REQUIRED: new Set([
    "bf4d83f9-5064-4958-af6e-e4c21b2e4880",
  ]),
};

type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "select" | "tel" | "email";
  inMandatoryColumn: boolean;
  required?: boolean;
  disabled?: boolean;
  render?: (commonProps: any) => React.ReactNode;
};

type OptState = { id: string | null; label: string | null };

function ClientForm({ entityOptions, countryOptions }: ClientProps) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<"idle" | "saving">("idle");
  const [msg, setMsg] = React.useState<string | null>(null);

  const [entityType, setEntityType] = React.useState<OptState>({ id: null, label: null });
  const [country, setCountry] = React.useState<OptState>({ id: null, label: null });

  const isIdRequired = !(entityType.id && UUIDS.ID_NOT_REQUIRED.has(entityType.id));
  const isBirthRequired = isIdRequired;
  const isSexRequired = !!(entityType.id && UUIDS.SEX_REQUIRED.has(entityType.id));
  const isPensionRequired = !!(entityType.id && UUIDS.PENSION_REQUIRED.has(entityType.id));

  const MANDATORY: Field[] = [
    { name: "name", label: "Name", inMandatoryColumn: true, required: true },
    { name: "identification_number", label: "ID", inMandatoryColumn: true, required: isIdRequired, disabled: !isIdRequired },
    {
      name: "birth_or_incorporation_date",
      label: "Birth or Incorporation Date",
      inMandatoryColumn: true,
      type: "date",
      required: isBirthRequired,
      disabled: !isBirthRequired,
    },
    {
      name: "entity_type_uuid",
      label: "Entity Type",
      inMandatoryColumn: true,
      required: true,
      render: (p) => (
        <select {...p} value={entityType.id ?? ""} onChange={(e) => {
          const id = e.target.value || null;
          const opt = entityOptions.find(o => o.id === id) || null;
          setEntityType({ id, label: opt?.label ?? null });
        }}>
          <option value="">— select —</option>
          {entityOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      ),
    },
    {
      name: "sex",
      label: "Sex",
      inMandatoryColumn: true,
      required: isSexRequired,
      disabled: !isSexRequired,
      render: (p) => (
        <select {...p} disabled={!isSexRequired} defaultValue="">
          <option value="">—</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      ),
    },
    {
      name: "pension_scheme",
      label: "Pension Scheme",
      inMandatoryColumn: true,
      required: isPensionRequired,
      disabled: !isPensionRequired,
      render: (p) => (
        <select {...p} disabled={!isPensionRequired} defaultValue="">
          <option value="">—</option>
          <option value="True">True</option>
          <option value="False">False</option>
        </select>
      ),
    },
    {
      name: "country_uuid",
      label: "Country",
      inMandatoryColumn: true,
      required: true,
      render: (p) => (
        <select {...p} value={country.id ?? ""} onChange={(e) => {
          const id = e.target.value || null;
          const opt = countryOptions.find(o => o.id === id) || null;
          setCountry({ id, label: opt?.label ?? null });
        }}>
          <option value="">— select —</option>
          {countryOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      ),
    },
  ];

  const OPTIONAL: Field[] = [
    { name: "address_line_1", label: "Address Line 1", inMandatoryColumn: false },
    { name: "address_line_2", label: "Address Line 2", inMandatoryColumn: false },
    { name: "zip_code", label: "ZIP Code", inMandatoryColumn: false },
    { name: "iban", label: "IBAN", inMandatoryColumn: false },
    { name: "swift", label: "SWIFT", inMandatoryColumn: false },
    { name: "director", label: "Director", inMandatoryColumn: false },
    { name: "director_id", label: "Director ID", inMandatoryColumn: false },
    { name: "email", label: "Email", type: "email", inMandatoryColumn: false },
    { name: "phone", label: "Phone", type: "tel", inMandatoryColumn: false },
    { name: "oris_id", label: "ORIS ID", inMandatoryColumn: false },
  ];

  const left = MANDATORY;
  const N = left.length;
  const middle = OPTIONAL.slice(0, N);
  const right = OPTIONAL.slice(N);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving("saving"); setMsg(null);

    const submitter = (e.nativeEvent as any).submitter as HTMLButtonElement | undefined;
    const intent = submitter?.value ?? "save";

    const fd = new FormData(e.currentTarget);
    const body: Record<string, any> = {};
    fd.forEach((v, k) => { body[k] = v === "" ? null : v; });

    if (!isIdRequired) body["identification_number"] = null;
    if (!isBirthRequired) body["birth_or_incorporation_date"] = null;
    if (!isSexRequired) body["sex"] = null;
    if (!isPensionRequired) body["pension_scheme"] = null;

    body["entity_type"] = entityType.label;
    body["country"] = country.label;

    const res = await fetch("/dictionaries/counteragents/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving("idle");
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j?.error ?? "Failed to save");
      return;
    }

    if (intent === "save-new") {
      (e.currentTarget as HTMLFormElement).reset();
      setEntityType({ id: null, label: null });
      setCountry({ id: null, label: null });
      setMsg("Saved. New blank form.");
    } else {
      router.push("/dictionaries/counteragents");
    }
  }

  const FieldRow = (f: Field) => {
    const commonProps: any = {
      name: f.name,
      required: !!f.required,
      disabled: !!f.disabled,
      className: "w-full border rounded px-3 py-2",
      type: f.type ?? "text",
    };
    return (
      <label key={f.name} className="block mb-4">
        <span className="block text-sm font-medium mb-1">
          {f.label}{f.required ? " *" : ""}
        </span>
        {f.render ? f.render(commonProps) : <input {...commonProps} />}
      </label>
    );
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">New Counteragent</h1>

      <form onSubmit={submit}>
        <input type="hidden" name="entity_type" value={entityType.label ?? ""} />
        <input type="hidden" name="country" value={country.label ?? ""} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>{left.map(FieldRow)}</div>
          <div>{middle.map(FieldRow)}</div>
          <div>{right.map(FieldRow)}</div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            value="save"
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            disabled={saving === "saving"}
          >
            {saving === "saving" ? "Saving…" : "Save"}
          </button>

          <button
            type="submit"
            value="save-new"
            className="px-4 py-2 rounded bg-gray-700 text-white disabled:opacity-50"
            disabled={saving === "saving"}
          >
            {saving === "saving" ? "Saving…" : "Save and New"}
          </button>

          <a href="/dictionaries/counteragents" className="ml-4 text-blue-600 hover:underline">Back</a>
          {msg && <span className="ml-3 text-sm">{msg}</span>}
        </div>
      </form>
    </div>
  );
}
'@

Write-Utf8NoBom "app/dictionaries/counteragents/new/page.tsx" $tsx

Write-Host "✓ wrote app/dictionaries/counteragents/new/page.tsx"
Write-Host "Now restart Next (npm run dev) and open /dictionaries/counteragents/new"
