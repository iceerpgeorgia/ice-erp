// ORIS accounting export: turns incoming waybill lines into accounting entries, the same way the
// "RS_Export_WB" Google Sheets did (tabs კორ. ანგ საქონელი / კორ. ანგ ხარჯი / პროექტის დანახარჯი →
// TRANSACTIONS + VAT TRANSACTIONS → Sylfaen → CSV). Pure functions, no database access.
//
// Scheme per line (from the sheets' Case_Matrix and filters):
//   account set, starts with 7   → expense: one entry per waybill, debit = the first line's account
//   account set, starts with 2   → fixed asset: not exported (the 2024 sheet filters these out)
//   account set, anything else   → goods: debit account_inventoryCode, credit 3_1_10_supplierOris
//   no account, project set      → project cost: 1_6_20_inventoryCode ← supplier, then project 1630 ← 1_6_20_inventoryCode
//   neither                      → not exportable
// VAT: one entry per waybill and VAT type, debit 3_3_40_01 (3_3_40_001 when the debit account starts
// with 2), credit the supplier account, amount = the VAT parts of that waybill's entries.
//
// One deliberate difference from the sheet: an expense waybill without VAT gets VAT 0. The sheet's
// formula (if VAT, 1 - 1/1.18, else 1) put the whole amount into VAT for such waybills.

export type OrisLine = {
  itemId: string;
  waybillNo: string;
  /** Waybill activation day in Tbilisi, dd.mm.yyyy. */
  date: string;
  supplierName: string | null;
  supplierOris: string | null;
  /** The waybill is from the company itself (internal transfer). */
  isOwnCompany: boolean;
  /** RS.ge waybill state, e.g. დასრულებული, აქტიური, გაუქმებული. */
  state: string | null;
  /** RS.ge waybill type, e.g. ტრანსპორტირებით, უკან დაბრუნება. */
  type: string | null;
  vat: boolean;
  total: number;
  goodsName: string | null;
  unit: string | null;
  quantity: number | null;
  startAddress: string | null;
  endAddress: string | null;
  /** Corresponding account of the line (or its waybill), e.g. 1_6_20, 7_4_41. */
  account: string | null;
  /** Inventory internal number, e.g. 10754. */
  inventoryCode: string | null;
  projectName: string | null;
  /** The project's ORIS 1630 account, e.g. "1 6 30 2492". */
  project1630: string | null;
};

export type OrisScheme = 'goods' | 'expense' | 'project' | 'fixed_asset' | 'none' | 'excluded';

export type LineResult = {
  line: OrisLine;
  scheme: OrisScheme;
  /** Why the line is not exported (empty when it is). */
  problems: string[];
};

export type OrisEntryKind = 'goods' | 'expense' | 'project_in' | 'project_out' | 'vat';

export type OrisEntry = {
  kind: OrisEntryKind;
  docNo: string;
  date: string;
  debit: string;
  credit: string;
  amount: number;
  vat: number;
  unit: string | null;
  quantity: number | null;
  comment: string | null;
  itemIds: string[];
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const vatPart = (total: number) => round2((total / 1.18) * 0.18);

const SUPPLIER_ACCOUNT_PREFIX = '3_1_10_';
const PROJECT_STOCK_ACCOUNT = '1_6_20';
const VAT_ACCOUNT = '3_3_40_01';
const VAT_CAPEX_ACCOUNT = '3_3_40_001';

export const supplierAccount = (line: OrisLine) => `${SUPPLIER_ACCOUNT_PREFIX}${line.supplierOris}`;

const text = (value: string | null) => (value && value.trim() !== 'null' ? value : '');

const comment = (line: OrisLine) =>
  `საქონელი: ${text(line.goodsName)}\nტრანსპოერირების დაწყება : ${text(line.startAddress)}\nტრანსპოერირების დასრულება : ${text(line.endAddress)}`;

export function classifyLine(line: OrisLine): LineResult {
  const problems: string[] = [];
  if (line.state === 'გაუქმებული') return { line, scheme: 'excluded', problems: ['Waybill is cancelled'] };
  if (line.isOwnCompany) return { line, scheme: 'excluded', problems: ['Waybill is from the company itself'] };
  if (line.type === 'უკან დაბრუნება') return { line, scheme: 'excluded', problems: ['Return waybill (not handled by the export)'] };
  if (!(line.total > 0)) return { line, scheme: 'excluded', problems: ['Amount is zero or negative'] };

  const account = line.account?.trim() || null;
  let scheme: OrisScheme;
  if (account) {
    if (account.startsWith('7')) scheme = 'expense';
    else if (account.startsWith('2')) return { line, scheme: 'fixed_asset', problems: ['Fixed-asset account (2_…) is not exported'] };
    else scheme = 'goods';
  } else if (line.project1630 || line.projectName) {
    scheme = 'project';
  } else {
    return { line, scheme: 'none', problems: ['No corresponding account and no project'] };
  }

  if (!line.supplierOris) problems.push('Supplier has no ORIS ID');
  if ((scheme === 'goods' || scheme === 'project') && !line.inventoryCode) problems.push('No inventory (or inventory has no internal number)');
  if (scheme === 'project' && !line.project1630) problems.push('Project has no ORIS 1630 account');
  return { line, scheme, problems };
}

/** Builds the entries in the sheet's order: goods, expenses, project step 1, project step 2, then VAT. */
export function buildEntries(lines: OrisLine[]) {
  const results = lines.map(classifyLine);
  const ok = results.filter((r) => r.problems.length === 0);

  const goods: OrisEntry[] = ok
    .filter((r) => r.scheme === 'goods')
    .map(({ line }) => {
      const vat = line.vat ? vatPart(line.total) : 0;
      return {
        kind: 'goods',
        docNo: line.waybillNo,
        date: line.date,
        debit: `${line.account!.trim()}_${line.inventoryCode}`,
        credit: supplierAccount(line),
        amount: round2(line.total - vat),
        vat,
        unit: line.unit,
        quantity: line.quantity,
        comment: comment(line),
        itemIds: [line.itemId],
      };
    });

  // Expenses: one entry per waybill, debit = the first line's account.
  const expenseByWaybill = new Map<string, OrisLine[]>();
  for (const { line } of ok.filter((r) => r.scheme === 'expense')) {
    const list = expenseByWaybill.get(line.waybillNo) ?? [];
    list.push(line);
    expenseByWaybill.set(line.waybillNo, list);
  }
  const expenses: OrisEntry[] = [...expenseByWaybill.values()].map((list) => {
    const first = list[0];
    const amount = round2(list.reduce((sum, l) => sum + (l.vat ? round2(l.total / 1.18) : l.total), 0));
    const vat = round2(list.reduce((sum, l) => sum + (l.vat ? round2(l.total * (1 - 1 / 1.18)) : 0), 0));
    return {
      kind: 'expense',
      docNo: first.waybillNo,
      date: first.date,
      debit: first.account!.trim(),
      credit: supplierAccount(first),
      amount,
      vat,
      unit: null,
      quantity: null,
      comment: null,
      itemIds: list.map((l) => l.itemId),
    };
  });

  const projectLines = ok.filter((r) => r.scheme === 'project').map((r) => r.line);
  const projectIn: OrisEntry[] = projectLines.map((line) => {
    const vat = line.vat ? vatPart(line.total) : 0;
    return {
      kind: 'project_in',
      docNo: line.waybillNo,
      date: line.date,
      debit: `${PROJECT_STOCK_ACCOUNT}_${line.inventoryCode}`,
      credit: supplierAccount(line),
      amount: round2(line.total - vat),
      vat,
      unit: line.unit,
      quantity: line.quantity,
      comment: comment(line),
      itemIds: [line.itemId],
    };
  });
  const projectOut: OrisEntry[] = projectIn.map((entry, index) => ({
    ...entry,
    kind: 'project_out',
    debit: projectLines[index].project1630!.trim(),
    credit: entry.debit,
    vat: 0,
  }));

  const transactions = [...goods, ...expenses, ...projectIn, ...projectOut];

  // VAT: per waybill and type (VAT / VAT Capex), summed over that waybill's entries.
  const vatGroups = new Map<string, { docNo: string; date: string; credit: string; capex: boolean; amount: number; itemIds: string[] }>();
  for (const entry of transactions) {
    if (entry.vat === 0) continue;
    const capex = entry.debit.startsWith('2');
    const key = `${entry.docNo}|${capex}`;
    const group = vatGroups.get(key) ?? { docNo: entry.docNo, date: entry.date, credit: entry.credit, capex, amount: 0, itemIds: [] };
    group.amount = round2(group.amount + entry.vat);
    group.itemIds.push(...entry.itemIds);
    vatGroups.set(key, group);
  }
  const vatEntries: OrisEntry[] = [...vatGroups.values()]
    .sort((a, b) => a.docNo.localeCompare(b.docNo) || Number(a.capex) - Number(b.capex))
    .map((group) => ({
      kind: 'vat',
      docNo: group.docNo,
      date: group.date,
      debit: group.capex ? VAT_CAPEX_ACCOUNT : VAT_ACCOUNT,
      credit: group.credit,
      amount: group.amount,
      vat: 0,
      unit: null,
      quantity: null,
      comment: null,
      itemIds: [...new Set(group.itemIds)],
    }));

  return { results, entries: [...transactions, ...vatEntries] };
}

// ── File layout ──────────────────────────────────────────────────────────────

const STOCK_PREFIXES = ['1_6_20', '1_6_10', '2', '1_6_70'];

/** The sheet's stock flag: 1 when the account is a stock account (1_6_20, 1_6_10, 1_6_70 or 2…). */
export const isStockAccount = (account: string) =>
  STOCK_PREFIXES.includes(account.startsWith('2') ? account.slice(0, 1) : account.slice(0, 6));

/** TEXT(x, " ######0.00"): a leading space, then the amount with two decimals. */
export const formatAmount = (value: number) => ` ${value.toFixed(2)}`;

// The sheet writes this executor text, cut off as it is there.
const EXECUTOR = 'სისტემის ადმინისტრატ';

/** One row of the Sylfaen tab (columns A–W) for one entry. */
export function sylfaenRow(entry: OrisEntry): Array<string | number> {
  const isTransaction = entry.kind !== 'vat';
  const debitStock = isStockAccount(entry.debit) ? 1 : '';
  const creditStock = isStockAccount(entry.credit) ? 1 : '';
  const quantity = isTransaction && (debitStock || creditStock) && entry.quantity !== null ? entry.quantity : '';
  return [
    entry.docNo, // A დოკ #
    0, // B
    entry.date, // C გატარების თარიღი
    entry.debit, // D ანგ. დებ.
    entry.credit, // E ანგ. კრედ.
    '', // F მემორიალი
    formatAmount(entry.amount), // G თანხა
    'GEL', // H ვალუტა
    isTransaction ? entry.comment ?? '' : '', // I დანიშნულება
    debitStock, // J
    creditStock, // K
    isTransaction ? entry.unit ?? '' : '', // L ერთეული
    quantity, // M დებეტის რაოდენობა
    quantity, // N კრედიტის რაოდენობა
    'IMPORT', // O
    EXECUTOR, // P შემსრულებელი
    0, // Q
    9, // R
    0, // S
    '', // T
    '', // U კურსი
    '', // V შესრულების თარიღი
    '', // W დაკავშირებული დოკუმენტი
  ];
}

// The sheet's CSV formula: Georgian letters to the ORIS (AcadNusx) font characters, ² → 2, ³ → 3.
const ORIS_LETTERS: Record<string, string> = {
  ა: 'À', ბ: 'Á', გ: 'Â', დ: 'Ã', ე: 'Ä', ვ: 'Å', ზ: 'Æ', თ: 'È', ი: 'É', კ: 'Ê', ლ: 'Ë',
  მ: 'Ì', ნ: 'Í', ო: 'Ï', პ: 'Ð', ჟ: 'Ñ', რ: 'Ò', ს: 'Ó', ტ: 'Ô', უ: 'Ö', ფ: '×', ქ: 'Ø',
  ღ: 'Ù', ყ: 'Ú', შ: 'Û', ჩ: 'Ü', ც: 'Ý', ძ: 'Þ', წ: 'ß', ჭ: 'à', ხ: 'á', ჯ: 'ã', ჰ: 'ä',
  '²': '2', '³': '3',
};

export const toOrisFont = (value: string) => value.replace(/[ა-ჰ²³]/g, (ch) => ORIS_LETTERS[ch] ?? ch);

/**
 * Rows of the CSV tab: three empty columns, then the Sylfaen columns converted to the ORIS font.
 * Like the sheet, rows without a date or with a zero or negative amount are left out.
 */
export function csvRows(entries: OrisEntry[]): Array<Array<string | number>> {
  return entries
    .filter((entry) => entry.date && entry.amount > 0)
    .map((entry) => ['', '', '', ...sylfaenRow(entry).map((cell) => (typeof cell === 'string' ? toOrisFont(cell) : cell))]);
}
