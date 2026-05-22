/**
 * Patch script: Income/Pension Tax gross-up feature for Projects Report
 * Run: node _patch_tax_feature.js
 */
const fs = require('fs');
const path = require('path');

function patch(fp, ...replacements) {
  let src = fs.readFileSync(fp, 'utf8').replace(/\r\n/g, '\n');
  const orig = src;
  for (const [oldStr, newStr, label] of replacements) {
    const count = src.split(oldStr).length - 1;
    if (count === 0) {
      console.error(`❌ [${path.basename(fp)}] NOT FOUND: ${label || oldStr.slice(0, 60)}`);
      process.exit(1);
    }
    if (count > 1) {
      console.error(`❌ [${path.basename(fp)}] AMBIGUOUS (${count} matches): ${label || oldStr.slice(0, 60)}`);
      process.exit(1);
    }
    src = src.replace(oldStr, newStr);
    console.log(`  ✓ ${label || 'replacement'}`);
  }
  fs.writeFileSync(fp, src, 'utf8');
  console.log(`✅ Patched ${path.basename(fp)} (${src.length - orig.length > 0 ? '+' : ''}${src.length - orig.length} chars)\n`);
}

// ─── 1. API ROUTE ─────────────────────────────────────────────────────────────

patch(
  'app/api/projects-report/route.ts',

  // 1a. Add payment_tax_flags CTE after payment_currencies
  [
    `        WHERE p.is_active = true
          AND p.project_uuid IN (\${projectPlaceholders})
      ),
      ledger_agg AS (`,
    `        WHERE p.is_active = true
          AND p.project_uuid IN (\${projectPlaceholders})
      ),
      payment_tax_flags AS (
        SELECT
          p.payment_id,
          COALESCE(p.income_tax, false) AS income_tax,
          COALESCE(ca.pension_scheme, false) AS pension_scheme
        FROM payments p
        LEFT JOIN counteragents ca ON ca.counteragent_uuid = p.counteragent_uuid
        WHERE p.is_active = true
          AND p.project_uuid IN (\${projectPlaceholders})
      ),
      ledger_agg AS (`,
    'Add payment_tax_flags CTE',
  ],

  // 1b. ledger_agg: add tax columns
  [
    `          SUM(COALESCE(pl.accrual, 0) * \${convFactor('pc.currency_code', 'nbg_l')}) AS total_accrual,
          SUM(COALESCE(pl."order", 0) * \${convFactor('pc.currency_code', 'nbg_l')}) AS total_order,
          BOOL_AND(COALESCE(pl.confirmed, false)) AS all_confirmed,
          COUNT(*) AS entries_count,
          MAX(pl.effective_date) AS latest_ledger_date
        FROM payments_ledger pl
        LEFT JOIN payment_currencies pc ON pc.payment_id = pl.payment_id`,
    `          SUM(COALESCE(pl.accrual, 0) * \${convFactor('pc.currency_code', 'nbg_l')}) AS total_accrual,
          SUM(COALESCE(pl."order", 0) * \${convFactor('pc.currency_code', 'nbg_l')}) AS total_order,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pl.accrual, 0) * \${convFactor('pc.currency_code', 'nbg_l')} ELSE 0 END) AS total_accrual_tax,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pl."order", 0) * \${convFactor('pc.currency_code', 'nbg_l')} ELSE 0 END) AS total_order_tax,
          BOOL_OR(CASE WHEN ptf.income_tax THEN ptf.pension_scheme ELSE false END) AS pension_on_tax,
          BOOL_AND(COALESCE(pl.confirmed, false)) AS all_confirmed,
          COUNT(*) AS entries_count,
          MAX(pl.effective_date) AS latest_ledger_date
        FROM payments_ledger pl
        LEFT JOIN payment_currencies pc ON pc.payment_id = pl.payment_id
        LEFT JOIN payment_tax_flags ptf ON ptf.payment_id = pl.payment_id`,
    'ledger_agg: add tax columns + ptf join',
  ],

  // 1c. ledger_latest: add tax column + join
  [
    `          SUM(COALESCE(pl.accrual, 0) * \${convFactor('pc.currency_code', 'nbg_ll')}) AS latest_accrual
        FROM payments_ledger pl
        JOIN latest_ledger_date_per_payment ldp
          ON ldp.payment_id = pl.payment_id
         AND ldp.latest_effective_date = pl.effective_date
        LEFT JOIN payment_currencies pc ON pc.payment_id = pl.payment_id`,
    `          SUM(COALESCE(pl.accrual, 0) * \${convFactor('pc.currency_code', 'nbg_ll')}) AS latest_accrual,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pl.accrual, 0) * \${convFactor('pc.currency_code', 'nbg_ll')} ELSE 0 END) AS latest_accrual_tax
        FROM payments_ledger pl
        JOIN latest_ledger_date_per_payment ldp
          ON ldp.payment_id = pl.payment_id
         AND ldp.latest_effective_date = pl.effective_date
        LEFT JOIN payment_currencies pc ON pc.payment_id = pl.payment_id
        LEFT JOIN payment_tax_flags ptf ON ptf.payment_id = pl.payment_id`,
    'ledger_latest: add latest_accrual_tax + ptf join',
  ],

  // 1d. ledger_last_month: add tax columns + join
  [
    `          SUM(COALESCE(pl.accrual, 0) * \${convFactor('pc.currency_code', 'nbg_lm')}) AS total_accrual,
          SUM(COALESCE(pl."order", 0) * \${convFactor('pc.currency_code', 'nbg_lm')}) AS total_order
        FROM payments_ledger pl
        LEFT JOIN payment_currencies pc ON pc.payment_id = pl.payment_id
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= pl.effective_date::date ORDER BY date DESC LIMIT 1
        ) nbg_lm ON true`,
    `          SUM(COALESCE(pl.accrual, 0) * \${convFactor('pc.currency_code', 'nbg_lm')}) AS total_accrual,
          SUM(COALESCE(pl."order", 0) * \${convFactor('pc.currency_code', 'nbg_lm')}) AS total_order,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pl.accrual, 0) * \${convFactor('pc.currency_code', 'nbg_lm')} ELSE 0 END) AS total_accrual_tax,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pl."order", 0) * \${convFactor('pc.currency_code', 'nbg_lm')} ELSE 0 END) AS total_order_tax
        FROM payments_ledger pl
        LEFT JOIN payment_currencies pc ON pc.payment_id = pl.payment_id
        LEFT JOIN payment_tax_flags ptf ON ptf.payment_id = pl.payment_id
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= pl.effective_date::date ORDER BY date DESC LIMIT 1
        ) nbg_lm ON true`,
    'ledger_last_month: add tax columns + ptf join',
  ],

  // 1e. bank_agg: add tax column
  [
    `          SUM(combined.nominal_amount * \${convFactor('pc.currency_code', 'nbg_b')}) AS total_payment,
          MAX(combined.transaction_date::date) AS latest_bank_date`,
    `          SUM(combined.nominal_amount * \${convFactor('pc.currency_code', 'nbg_b')}) AS total_payment,
          SUM(CASE WHEN ptf.income_tax THEN combined.nominal_amount * \${convFactor('pc.currency_code', 'nbg_b')} ELSE 0 END) AS total_payment_tax,
          MAX(combined.transaction_date::date) AS latest_bank_date`,
    'bank_agg: add total_payment_tax column',
  ],

  // 1f. bank_agg: add ptf join
  [
    `        LEFT JOIN payment_currencies pc ON pc.payment_id = combined.payment_id
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= combined.transaction_date::date ORDER BY date DESC LIMIT 1
        ) nbg_b ON true`,
    `        LEFT JOIN payment_currencies pc ON pc.payment_id = combined.payment_id
        LEFT JOIN payment_tax_flags ptf ON ptf.payment_id = combined.payment_id
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= combined.transaction_date::date ORDER BY date DESC LIMIT 1
        ) nbg_b ON true`,
    'bank_agg: add ptf join',
  ],

  // 1g. adj_agg: add tax column + join
  [
    `          SUM(COALESCE(pa.nominal_amount, pa.amount) * \${convFactor('pc.currency_code', 'nbg_a')}) AS total_adjustment
        FROM payment_adjustments pa
        LEFT JOIN payment_currencies pc ON pc.payment_id = pa.payment_id`,
    `          SUM(COALESCE(pa.nominal_amount, pa.amount) * \${convFactor('pc.currency_code', 'nbg_a')}) AS total_adjustment,
          SUM(CASE WHEN ptf.income_tax THEN COALESCE(pa.nominal_amount, pa.amount) * \${convFactor('pc.currency_code', 'nbg_a')} ELSE 0 END) AS total_adjustment_tax
        FROM payment_adjustments pa
        LEFT JOIN payment_currencies pc ON pc.payment_id = pa.payment_id
        LEFT JOIN payment_tax_flags ptf ON ptf.payment_id = pa.payment_id`,
    'adj_agg: add total_adjustment_tax + ptf join',
  ],

  // 1h. Final SELECT: add tax aggregates before the payment column
  [
    `        SUM(COALESCE(ba.total_payment, 0) + COALESCE(adj.total_adjustment, 0)) AS payment,`,
    `        SUM(COALESCE(la.total_accrual_tax, 0)) AS accrual_tax,
        SUM(COALESCE(ll.latest_accrual_tax, 0)) AS latest_accrual_tax,
        SUM(COALESCE(la.total_order_tax, 0)) AS order_tax,
        SUM(COALESCE(llm.total_accrual_tax, 0)) AS last_month_accrual_tax,
        SUM(COALESCE(llm.total_order_tax, 0)) AS last_month_order_tax,
        SUM(COALESCE(ba.total_payment_tax, 0) + COALESCE(adj.total_adjustment_tax, 0)) AS payment_tax,
        BOOL_OR(COALESCE(la.pension_on_tax, false)) AS pension_on_tax,
        SUM(COALESCE(ba.total_payment, 0) + COALESCE(adj.total_adjustment, 0)) AS payment,`,
    'Final SELECT: add 7 tax aggregate columns',
  ],

  // 1i. API TypeScript cell shape: add tax fields
  [
    `        paymentIds: string[];
        latestDate: string | null;
      }[];`,
    `        paymentIds: string[];
        latestDate: string | null;
        accrualTax: number;
        latestAccrualTax: number;
        orderTax: number;
        lastMonthAccrualTax: number;
        lastMonthOrderTax: number;
        paymentTax: number;
        pensionOnTax: boolean;
      }[];`,
    'API cell type: add 7 tax fields',
  ],

  // 1j. Row mapping: add tax field assignments
  [
    `        latestDate: row.latest_date || null,
      });`,
    `        latestDate: row.latest_date || null,
        accrualTax: Number(row.accrual_tax || 0),
        latestAccrualTax: Number(row.latest_accrual_tax || 0),
        orderTax: Number(row.order_tax || 0),
        lastMonthAccrualTax: Number(row.last_month_accrual_tax || 0),
        lastMonthOrderTax: Number(row.last_month_order_tax || 0),
        paymentTax: Number(row.payment_tax || 0),
        pensionOnTax: Boolean(row.pension_on_tax),
      });`,
    'Row mapping: assign 7 tax fields',
  ],
);

// ─── 2. FRONTEND COMPONENT ────────────────────────────────────────────────────

patch(
  'components/figma/projects-report-table.tsx',

  // 2a. CellData type: add tax fields
  [
    `  paymentIds: string[];
  latestDate: string | null;
};`,
    `  paymentIds: string[];
  latestDate: string | null;
  accrualTax: number;
  latestAccrualTax: number;
  orderTax: number;
  lastMonthAccrualTax: number;
  lastMonthOrderTax: number;
  paymentTax: number;
  pensionOnTax: boolean;
};`,
    'CellData type: add 7 tax fields',
  ],

  // 2b. Add showTaxMultiplier state (after settingsOpen)
  [
    `  const [settingsOpen, setSettingsOpen] = useState(false);`,
    `  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTaxMultiplier, setShowTaxMultiplier] = useState(false);`,
    'Add showTaxMultiplier state',
  ],

  // 2c. localStorage sync for showTaxMultiplier – piggyback on projectCurrenciesRef effect
  [
    `  useEffect(() => { projectCurrenciesRef.current = projectCurrencies; }, [projectCurrencies]);`,
    `  useEffect(() => { projectCurrenciesRef.current = projectCurrencies; }, [projectCurrencies]);
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('projectsReportTaxMult') === 'true') {
      setShowTaxMultiplier(true);
    }
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('projectsReportTaxMult', String(showTaxMultiplier));
    }
  }, [showTaxMultiplier]);`,
    'showTaxMultiplier localStorage persistence effects',
  ],

  // 2d. Add effectiveValue function + update getCellValue
  [
    `  const getCellValue = (cell: CellData, metric: MetricKey): number => cell[metric] as number;`,
    `  const effectiveValue = (cell: CellData, metric: MetricKey): number => {
    if (!showTaxMultiplier) return cell[metric] as number;
    const factor = cell.pensionOnTax ? 1.25 * 1.04 : 1.25;
    switch (metric) {
      case 'accrual': return (cell.accrual - cell.accrualTax) + cell.accrualTax * factor;
      case 'latestAccrual': return (cell.latestAccrual - cell.latestAccrualTax) + cell.latestAccrualTax * factor;
      case 'order': return (cell.order - cell.orderTax) + cell.orderTax * factor;
      case 'lastMonthAccrual': return (cell.lastMonthAccrual - cell.lastMonthAccrualTax) + cell.lastMonthAccrualTax * factor;
      case 'lastMonthOrder': return (cell.lastMonthOrder - cell.lastMonthOrderTax) + cell.lastMonthOrderTax * factor;
      case 'payment': return (cell.payment - cell.paymentTax) + cell.paymentTax * factor;
      case 'due': {
        const o = (cell.order - cell.orderTax) + cell.orderTax * factor;
        const p = (cell.payment - cell.paymentTax) + cell.paymentTax * factor;
        return Number((o - Math.abs(p)).toFixed(2));
      }
      case 'balance': {
        const a = (cell.accrual - cell.accrualTax) + cell.accrualTax * factor;
        const p = (cell.payment - cell.paymentTax) + cell.paymentTax * factor;
        return Number((a - Math.abs(p)).toFixed(2));
      }
      case 'accrualPerFloor': {
        const a = (cell.accrual - cell.accrualTax) + cell.accrualTax * factor;
        return cell.jobFloors > 0 ? Number((a / cell.jobFloors).toFixed(2)) : 0;
      }
      default:
        return cell[metric] as number;
    }
  };
  const getCellValue = (cell: CellData, metric: MetricKey): number => effectiveValue(cell, metric);`,
    'Add effectiveValue + update getCellValue',
  ],

  // 2e. autoColWidthsMap: fix cell[m] #1 — individual cell value
  [
    `            const v = cell ? (cell[m] as number) : 0;`,
    `            const v = cell ? effectiveValue(cell, m) : 0;`,
    'autoColWidthsMap: fix cell[m] #1 (individual cell)',
  ],

  // 2f. autoColWidthsMap: fix cell[m] #2 — colTotal reduce
  [
    `              return s + (cell ? (cell[m] as number) : 0);`,
    `              return s + (cell ? effectiveValue(cell, m) : 0);`,
    'autoColWidthsMap: fix cell[m] #2 (colTotal)',
  ],

  // 2g. autoColWidthsMap: fix cell[m] #3 — rowTotal reduce
  [
    `          return sum + activeMetrics.reduce((s, m) => NON_ADDITIVE_METRICS.has(m) ? s : s + (cell[m] as number), 0);`,
    `          return sum + activeMetrics.reduce((s, m) => NON_ADDITIVE_METRICS.has(m) ? s : s + effectiveValue(cell, m), 0);`,
    'autoColWidthsMap: fix cell[m] #3 (rowTotal)',
  ],

  // 2h. Settings panel: add tax toggle before "Default currency" section
  [
    `                <div className="mt-3 pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Default currency for new projects</p>
                  <div className="flex gap-1">`,
    `                <div className="mt-3 pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Calculation</p>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      className={\`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors \${showTaxMultiplier ? 'bg-blue-600' : 'bg-gray-200'}\`}
                      onClick={() => setShowTaxMultiplier((v) => !v)}
                    >
                      <span className={\`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform \${showTaxMultiplier ? 'translate-x-4' : 'translate-x-0'}\`} />
                    </div>
                    <span className="text-xs text-gray-700">Income/Pension Tax gross-up</span>
                  </label>
                  <p className="text-[10px] text-gray-400 mt-1 ml-11">×1.25 income tax · ×1.04 pension</p>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Default currency for new projects</p>
                  <div className="flex gap-1">`,
    'Settings panel: add Income/Pension Tax toggle',
  ],
);

console.log('All patches applied successfully!');
