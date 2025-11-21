"use client";

import React from "react";
import { useRouter } from "next/navigation";

type Opt = { id: string; label: string };
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
  PENSION_REQUIRED: new Set(["bf4d83f9-5064-4958-af6e-e4c21b2e4880"]),
};

type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "select" | "tel" | "email" | "checkbox";
  required?: boolean;
  disabled?: boolean;
  render?: (commonProps: any) => React.ReactNode;
};

type OptState = { id: string | null; label: string | null };

export default function ClientForm({ entityOptions, countryOptions }: ClientProps) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<"idle" | "saving">("idle");
  const [msg, setMsg] = React.useState<string | null>(null);

  const [entityType, setEntityType] = React.useState<OptState>({ id: null, label: null });
  const [country, setCountry] = React.useState<OptState>({ id: null, label: null });

  const isIdRequired = !(entityType.id && UUIDS.ID_NOT_REQUIRED.has(entityType.id));
  // Birth/registration date should not be mandatory
  const isBirthRequired = false;
  const isSexRequired = !!(entityType.id && UUIDS.SEX_REQUIRED.has(entityType.id));
  const isPensionRequired = !!(entityType.id && UUIDS.PENSION_REQUIRED.has(entityType.id));

  // Left column: mandatory
  const MANDATORY: Field[] = [
    { name: "name", label: "Name", required: true },
    { name: "identification_number", label: "ID", required: isIdRequired, disabled: !isIdRequired },
    {
      name: "birth_or_incorporation_date",
      label: "Birth or Incorporation Date",
      type: "date",
      required: isBirthRequired,
      // keep enabled even when not required
      disabled: false,
    },
    {
      name: "entity_type_uuid",
      label: "Entity Type",
      required: true,
      render: (p) => (
        <select
          {...p}
          value={entityType.id ?? ""}
          onChange={(e) => {
            const id = e.target.value || null;
            const opt = entityOptions.find((o) => o.id === id) || null;
            setEntityType({ id, label: opt?.label ?? null });
          }}
        >
          <option value="">Select</option>
          {entityOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      name: "sex",
      label: "Sex",
      required: isSexRequired,
      disabled: !isSexRequired,
      render: (p) => (
        <select {...p} disabled={!isSexRequired} defaultValue="">
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      ),
    },
    {
      name: "pension_scheme",
      label: "Pension Scheme",
      required: isPensionRequired,
      disabled: !isPensionRequired,
      render: (p) => (
        <select {...p} disabled={!isPensionRequired} defaultValue="">
          <option value="">Select</option>
          <option value="True">True</option>
          <option value="False">False</option>
        </select>
      ),
    },
    {
      name: "country_uuid",
      label: "Country",
      required: true,
      render: (p) => (
        <select
          {...p}
          value={country.id ?? ""}
          onChange={(e) => {
            const id = e.target.value || null;
            const opt = countryOptions.find((o) => o.id === id) || null;
            setCountry({ id, label: opt?.label ?? null });
          }}
        >
          <option value="">Select</option>
          {countryOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      name: "was_emploee",
      label: "Was Employee",
      render: (p) => (
        <select {...p} defaultValue="">
          <option value="">Select</option>
          <option value="True">True</option>
          <option value="False">False</option>
        </select>
      ),
    },
  ];

  // Right columns: optional
  const OPTIONAL: Field[] = [
    { name: "address_line_1", label: "Address Line 1" },
    { name: "address_line_2", label: "Address Line 2" },
    { name: "zip_code", label: "ZIP Code" },
    { name: "iban", label: "IBAN" },
    { name: "swift", label: "SWIFT" },
    { name: "director", label: "Director" },
    { name: "director_id", label: "Director ID" },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "oris_id", label: "ORIS ID" },

    // NEW: boolean field (select True/False). If you prefer a checkbox, tell me and I'll switch it.
    {
      name: "is_emploee",
      label: "Is Employee",
      render: (p) => (
        <select {...p} defaultValue="">
          <option value="">Select</option>
          <option value="True">True</option>
          <option value="False">False</option>
        </select>
      ),
    },
  ];

  const left = MANDATORY;
  const N = left.length;
  const middle = OPTIONAL.slice(0, N);
  const right = OPTIONAL.slice(N);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving("saving");
    setMsg(null);

    const submitter = (e.nativeEvent as any).submitter as HTMLButtonElement | undefined;
    const intent = submitter?.value ?? "save";

    const fd = new FormData(e.currentTarget);
    const body: Record<string, any> = {};
    fd.forEach((v, k) => {
      body[k] = v === "" ? null : v;
    });

    // Conditional nulling
    if (!isIdRequired) body["identification_number"] = null;
    if (!isBirthRequired) body["birth_or_incorporation_date"] = null;
    if (!isSexRequired) body["sex"] = null;
    if (!isPensionRequired) body["pension_scheme"] = null;

    // Human-readable labels
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
      className: "w-full border rounded px-3 py-2 disabled:bg-gray-100",
      type: f.type ?? "text",
    };
    return (
      <label key={f.name} className="block mb-4">
        <span className="block text-sm font-medium mb-1">
          {f.label}
          {f.required ? " *" : ""}
        </span>
        {f.render ? f.render(commonProps) : <input {...commonProps} />}
      </label>
    );
  };

  return (
    <form onSubmit={onSubmit}>
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
          {saving === "saving" ? "Saving..." : "Save"}
        </button>

        <button
          type="submit"
          value="save-new"
          className="px-4 py-2 rounded bg-gray-700 text-white disabled:opacity-50"
          disabled={saving === "saving"}
        >
          {saving === "saving" ? "Saving..." : "Save and New"}
        </button>

        <a href="/dictionaries/counteragents" className="ml-4 text-blue-600 hover:underline">
          Back
        </a>
        {msg && <span className="ml-3 text-sm">{msg}</span>}
      </div>
    </form>
  );
}

