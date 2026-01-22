"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

type ET = { name_ka: string; entity_type_uuid: string };
type Props = {
  mode: "create" | "edit";
  initial?: any | null;
  countries: string[];
  entityTypes: ET[];
};

const PERSON_11 = new Set(["bf4d83f9-5064-4958-af6e-e4c21b2e4880","470412f4-e2c0-4f9d-91f1-1c0630a02364","ba538574-e93f-4ce8-a780-667b61fc970a"]);
const EXEMPT    = new Set(["f5c3c745-eaa4-4e27-a73b-badc9ebb49c0","7766e9c2-0094-4090-adf4-ef017062457f","5747f8e6-a8a6-4a23-91cc-c427c3a22597"]); // ID not required
const SEX_REQ   = new Set(["bf4d83f9-5064-4958-af6e-e4c21b2e4880","5747f8e6-a8a6-4a23-91cc-c427c3a22597","ba538574-e93f-4ce8-a780-667b61fc970a"]);
const NO_ID_VALIDATION = new Set(["5747f8e6-a8a6-4a23-91cc-c427c3a22597"]); // Entity types that don't require 9-digit ID format
const PENS_REQ  = "bf4d83f9-5064-4958-af6e-e4c21b2e4880";

export default function CounteragentForm({ mode, initial, countries, entityTypes }: Props) {
  const r = useRouter();
  const [v, setV] = React.useState<any>(() => initial ?? {});
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const etUuid = v.entity_type_uuid || "";
  const mandatory = {
    name: true,
    identification_number: !EXEMPT.has(etUuid),
    // Make birth_or_incorporation_date optional for all entity types
    birth_or_incorporation_date: false,
    entity_type: true,
    sex: SEX_REQ.has(etUuid),
    pension_scheme: etUuid === PENS_REQ,
    country: true,
  };

  // auto-fill entity_type text when UUID changes
  React.useEffect(() => {
    const found = entityTypes.find(e => e.entity_type_uuid === etUuid);
    setV((s:any)=>({ ...s, entity_type: found?.name_ka ?? s.entity_type }));
  }, [etUuid]); // eslint-disable-line

  // clear conditionals when not applicable
  React.useEffect(() => {
    setV((s:any)=>({
      ...s,
      sex: SEX_REQ.has(etUuid) ? s.sex : "",
      pension_scheme: etUuid === PENS_REQ ? (s.pension_scheme ?? null) : null
    }));
  }, [etUuid]);

  function field(label:string, name:string, input:React.ReactNode, req=false) {
    return (
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1">{label}{req && <span className="text-red-600"> *</span>}</span>
        {input}
      </label>
    );
  }

  function inputText(name:string, disabled=false, type="text") {
    return (
      <input
        className="w-full border rounded px-3 py-2"
        type={type}
        disabled={disabled}
        value={v[name] ?? ""}
        onChange={(e)=>setV((s:any)=>({ ...s, [name]: e.target.value }))}
      />
    );
  }

  async function submit(nextNew=false) {
    setSaving(true); setErr(null);
    try {
      // Debug: log entity type UUID and validation state
      console.log("🔍 Entity Type UUID:", etUuid);
      console.log("🔍 In EXEMPT set:", EXEMPT.has(etUuid));
      console.log("🔍 mandatory.identification_number:", mandatory.identification_number);
      console.log("🔍 ID value:", v.identification_number);

      // validations
      if (mandatory.name && !v.name?.trim()) throw new Error("Name is required");
      if (mandatory.entity_type && !etUuid) throw new Error("Entity Type is required");
      if (mandatory.country && !v.country) throw new Error("Country is required");
      // birth_or_incorporation_date is optional; no validation enforced

      if (!EXEMPT.has(etUuid) && !NO_ID_VALIDATION.has(etUuid) && v.identification_number) {
        const re = PERSON_11.has(etUuid) ? /^[0-9]{11}$/ : /^[0-9]{9}$/;
        if (!re.test(v.identification_number)) throw new Error("ID format is invalid");
      }
      if (mandatory.identification_number && !v.identification_number) throw new Error("ID is required");

      if (SEX_REQ.has(etUuid)) {
        if (v.sex !== "Male" && v.sex !== "Female") throw new Error("Sex must be Male or Female");
      } else {
        v.sex = "";
      }
      if (etUuid === PENS_REQ) {
        if (v.pension_scheme !== true && v.pension_scheme !== false) throw new Error("Pension Scheme must be True or False");
      } else {
        v.pension_scheme = null;
      }

      const payload = { ...v };
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch("/dictionaries/counteragents/api", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) throw new Error("A counteragent with the same ID already exists");
      if (!res.ok) throw new Error((await res.json())?.error ?? "Save failed");

      if (nextNew) {
        // reset minimal fields
        setV({ entity_type_uuid: v.entity_type_uuid, entity_type: v.entity_type });
      } else {
        r.push("/dictionaries/counteragents");
      }
    } catch (e:any) {
      setErr(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  // Build 3 columns: left = mandatory fields only
  const mandatoryFields = [
    field("Name","name", inputText("name"), mandatory.name),
    field("ID","identification_number", inputText("identification_number"), mandatory.identification_number),
    field("Birth or Incorporation Date","birth_or_incorporation_date",
      <input className="w-full border rounded px-3 py-2" type="date"
        value={v.birth_or_incorporation_date ?? ""} onChange={(e)=>setV((s:any)=>({ ...s, birth_or_incorporation_date:e.target.value }))} />,
      mandatory.birth_or_incorporation_date),
    field("Entity Type","entity_type",
      <select className="w-full border rounded px-3 py-2" value={etUuid || ""}
        onChange={(e)=>setV((s:any)=>({ ...s, entity_type_uuid:e.target.value }))}>
        <option value="">-- select --</option>
        {entityTypes.map(et => <option key={et.entity_type_uuid} value={et.entity_type_uuid}>{et.name_ka}</option>)}
      </select>,
      mandatory.entity_type),
    field("Sex","sex",
      <select className="w-full border rounded px-3 py-2" disabled={!SEX_REQ.has(etUuid)} value={v.sex || ""}
        onChange={(e)=>setV((s:any)=>({ ...s, sex:e.target.value }))}>
        <option value="">--</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </select>,
      mandatory.sex),
    field("Pension Scheme","pension_scheme",
      <select className="w-full border rounded px-3 py-2" disabled={etUuid!==PENS_REQ} value={v.pension_scheme == null ? "" : String(v.pension_scheme)} onChange={(e)=>setV((s:any)=>({ ...s, pension_scheme: e.target.value===''? null : e.target.value==='true' }))}>
        <option value="">--</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>,
      mandatory.pension_scheme),
    field("Country","country",
      <select className="w-full border rounded px-3 py-2" value={v.country || ""} onChange={(e)=>setV((s:any)=>({ ...s, country:e.target.value }))}>
        <option value="">-- select --</option>
        {countries.map(c => <option key={c} value={c}>{c}</option>)}
      </select>,
      mandatory.country),
  ];

  const optionalFields = [
    field("Address Line 1","address_line_1", inputText("address_line_1")),
    field("Address Line 2","address_line_2", inputText("address_line_2")),
    field("ZIP Code","zip_code", inputText("zip_code")),
    field("IBAN","iban", inputText("iban")),
    field("SWIFT","swift", inputText("swift")),
    field("Director","director", inputText("director")),
    field("Director ID","director_id", inputText("director_id")),
    field("Email","email", inputText("email","text" as any)),
    field("Phone","phone", inputText("phone")),
    field("ORIS ID","oris_id", inputText("oris_id")),
    field("Is Employee","is_emploee",
      <select className="w-full border rounded px-3 py-2" value={v.is_emploee == null ? "" : String(v.is_emploee)}
        onChange={(e)=>setV((s:any)=>({ ...s, is_emploee: e.target.value === '' ? null : e.target.value === 'true' }))}>
        <option value="">--</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    ),
    field("Was Employee","was_emploee",
      <select className="w-full border rounded px-3 py-2" value={v.was_emploee == null ? "" : String(v.was_emploee)}
        onChange={(e)=>setV((s:any)=>({ ...s, was_emploee: e.target.value === '' ? null : e.target.value === 'true' }))}>
        <option value="">--</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    ),
  ];

  // split optional to two columns roughly matching mandatory count
  const leftOpt = optionalFields.slice(0, Math.ceil(optionalFields.length/2));
  const rightOpt = optionalFields.slice(Math.ceil(optionalFields.length/2));

  return (
    <div>
      {err && <div className="mb-3 text-red-600">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>{mandatoryFields}</div>
        <div>{leftOpt}</div>
        <div>{rightOpt}</div>
      </div>

      <div className="mt-6 flex gap-2">
        <button disabled={saving} onClick={()=>submit(false)} className="px-4 py-2 rounded bg-blue-600 text-white">{saving?"Savingâ€¦":"Save"}</button>
        <button disabled={saving} onClick={()=>submit(true)} className="px-4 py-2 rounded border">Save and New</button>
        <a href="/dictionaries/counteragents" className="px-4 py-2 rounded border ml-auto">Back</a>
      </div>
    </div>
  );
}
