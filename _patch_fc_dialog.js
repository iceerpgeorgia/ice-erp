const fs = require('fs');
let src = fs.readFileSync('components/financial-codes-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// 1. Add defaultCodeFc to formData initial state
const OLD_FORMDATA = `  const [formData, setFormData] = useState({
    codeNumber: "",
    name: "",
    description: "",
    isIncome: false,
    appliesToPL: false,
    appliesToCF: false,
    isActive: true,
    automatedPaymentId: false,
    isBundle: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);`;

const NEW_FORMDATA = `  const [formData, setFormData] = useState({
    codeNumber: "",
    name: "",
    description: "",
    isIncome: false,
    appliesToPL: false,
    appliesToCF: false,
    isActive: true,
    automatedPaymentId: false,
    isBundle: false,
    defaultCodeFc: null as string | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [costFCs, setCostFCs] = useState<{ uuid: string; code: string; name: string }[]>([]);

  // Fetch cost financial codes for the pairing dropdown
  useEffect(() => {
    fetch('/api/financial-codes?isIncome=false&leafOnly=true')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.codes ?? []);
        setCostFCs(list.map((c: any) => ({ uuid: c.uuid, code: c.code, name: c.name })));
      })
      .catch(() => {});
  }, []);`;

const c1 = src.split(OLD_FORMDATA).length - 1;
if (c1 !== 1) { console.error('Step 1 anchor count:', c1); process.exit(1); }
src = src.replace(OLD_FORMDATA, NEW_FORMDATA);
console.log('Step 1: formData + costFCs state added');

// 2. Populate defaultCodeFc in the editing useEffect
const OLD_SETEDIT = `      setFormData({
        codeNumber,
        name: code.name,
        description: code.description || "",
        isIncome: code.isIncome,
        appliesToPL: code.appliesToPL,
        appliesToCF: code.appliesToCF,
        isActive: code.isActive,
        automatedPaymentId: code.automatedPaymentId,
        isBundle: code.isBundle,
      });`;

const NEW_SETEDIT = `      setFormData({
        codeNumber,
        name: code.name,
        description: code.description || "",
        isIncome: code.isIncome,
        appliesToPL: code.appliesToPL,
        appliesToCF: code.appliesToCF,
        isActive: code.isActive,
        automatedPaymentId: code.automatedPaymentId,
        isBundle: code.isBundle,
        defaultCodeFc: code.defaultCodeFc ?? null,
      });`;

const c2 = src.split(OLD_SETEDIT).length - 1;
if (c2 !== 1) { console.error('Step 2 anchor count:', c2); process.exit(1); }
src = src.replace(OLD_SETEDIT, NEW_SETEDIT);
console.log('Step 2: defaultCodeFc populated in edit useEffect');

// 3. Add defaultCodeFc to the submit payload
const OLD_PAYLOAD = `      const payload = {
        ...(code && { id: code.id }),
        code: fullCode,
        name: formData.name,
        description: formData.description,
        isIncome: formData.isIncome,
        appliesToPL: formData.appliesToPL,
        appliesToCF: formData.appliesToCF,
        isActive: formData.isActive,
        automatedPaymentId: formData.automatedPaymentId,
        isBundle: formData.isBundle,
        parentUuid: parent?.uuid || null,
      };`;

const NEW_PAYLOAD = `      const payload = {
        ...(code && { id: code.id }),
        code: fullCode,
        name: formData.name,
        description: formData.description,
        isIncome: formData.isIncome,
        appliesToPL: formData.appliesToPL,
        appliesToCF: formData.appliesToCF,
        isActive: formData.isActive,
        automatedPaymentId: formData.automatedPaymentId,
        isBundle: formData.isBundle,
        parentUuid: parent?.uuid || null,
        defaultCodeFc: formData.isIncome ? (formData.defaultCodeFc || null) : null,
      };`;

const c3 = src.split(OLD_PAYLOAD).length - 1;
if (c3 !== 1) { console.error('Step 3 anchor count:', c3); process.exit(1); }
src = src.replace(OLD_PAYLOAD, NEW_PAYLOAD);
console.log('Step 3: defaultCodeFc added to submit payload');

// 4. Add the dropdown UI — insert it after the isBundle checkbox block and before errors._form
const OLD_UI_ANCHOR = `          {errors._form && <p className="text-red-600 text-sm">{errors._form}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t">`;

const NEW_UI_ANCHOR = `          {formData.isIncome && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Default Cost FC for Waybills
              </label>
              <select
                value={formData.defaultCodeFc ?? ""}
                onChange={(e) => setFormData({ ...formData, defaultCodeFc: e.target.value || null })}
                className="w-full px-3 py-2 border rounded-lg bg-white"
              >
                <option value="">— None —</option>
                {costFCs.map((fc) => (
                  <option key={fc.uuid} value={fc.uuid}>
                    {fc.code} — {fc.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Waybill costs from this cost FC will appear in the Projects Report Waybills column.
              </p>
            </div>
          )}

          {errors._form && <p className="text-red-600 text-sm">{errors._form}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t">`;

const c4 = src.split(OLD_UI_ANCHOR).length - 1;
if (c4 !== 1) { console.error('Step 4 anchor count:', c4); process.exit(1); }
src = src.replace(OLD_UI_ANCHOR, NEW_UI_ANCHOR);
console.log('Step 4: Default Cost FC dropdown added to dialog');

fs.writeFileSync('components/financial-codes-table.tsx', src, 'utf8');
console.log('All done.');
