import { buildEntries, classifyLine, csvRows, isStockAccount, sylfaenRow, toOrisFont, type OrisLine } from './entries';

const line = (overrides: Partial<OrisLine> = {}): OrisLine => ({
  itemId: '1',
  waybillNo: '873309993',
  date: '20.01.2025',
  supplierName: 'ენერჯი ბაზა #1',
  supplierOris: '2676',
  isOwnCompany: false,
  state: 'დასრულებული',
  type: 'ტრანსპორტირების გარეშე',
  vat: true,
  total: 700,
  goodsName: 'FAVORIT 10w40 10 L',
  unit: 'ცალი',
  quantity: 14,
  startAddress: 'ქ თბილისი',
  endAddress: '',
  account: '1_6_20',
  inventoryCode: '10754',
  projectName: null,
  project1630: null,
  ...overrides,
});

describe('ORIS export entries', () => {
  it('posts a goods line like the sheet (amount without VAT, supplier credit)', () => {
    const { entries } = buildEntries([line()]);
    expect(entries).toHaveLength(2);
    const [goods, vat] = entries;
    expect(goods).toMatchObject({ kind: 'goods', debit: '1 6 20 10754', credit: '3 1 10 2676', amount: 593.22, vat: 106.78, quantity: 14 });
    expect(vat).toMatchObject({ kind: 'vat', debit: '3 3 40 01', credit: '3 1 10 2676', amount: 106.78 });
  });

  it('matches the sheet amount for 97 GEL with VAT', () => {
    const { entries } = buildEntries([line({ total: 97, account: '1_6_70', inventoryCode: '03098' })]);
    expect(entries[0].amount).toBe(82.2);
  });

  it('posts project cost in two steps, into stock then to the project 1630 account', () => {
    const { entries } = buildEntries([line({ account: null, projectName: 'Dry Port', project1630: '1 6 30 2492', total: 20, inventoryCode: '01801' })]);
    const kinds = entries.map((e) => e.kind);
    expect(kinds).toEqual(['project_in', 'project_out', 'vat']);
    expect(entries[0]).toMatchObject({ debit: '1 6 20 01801', credit: '3 1 10 2676' });
    expect(entries[1]).toMatchObject({ debit: '1 6 30 2492', credit: '1 6 20 01801', amount: entries[0].amount, vat: 0 });
    expect(entries[2].amount).toBe(entries[0].vat);
  });

  it('posts expenses once per waybill on the first line account', () => {
    const { entries } = buildEntries([
      line({ itemId: '1', account: '7_4_41', total: 25.5, inventoryCode: null }),
      line({ itemId: '2', account: '7_4_91', total: 12.6, inventoryCode: null }),
    ]);
    const expense = entries.find((e) => e.kind === 'expense')!;
    expect(expense.debit).toBe('7 4 41');
    expect(expense.amount).toBe(Math.round((25.5 / 1.18) * 100) / 100 + Math.round((12.6 / 1.18) * 100) / 100);
    expect(expense.itemIds).toEqual(['1', '2']);
  });

  it('gives an expense waybill without VAT no VAT entry (the sheet put the full amount there)', () => {
    const { entries } = buildEntries([line({ account: '7_4_41', vat: false, total: 50, inventoryCode: null })]);
    expect(entries.map((e) => e.kind)).toEqual(['expense']);
    expect(entries[0]).toMatchObject({ amount: 50, vat: 0 });
  });

  it('leaves out cancelled, own-company, return, fixed-asset and unassigned lines, and reports missing codes', () => {
    expect(classifyLine(line({ state: 'გაუქმებული' })).scheme).toBe('excluded');
    expect(classifyLine(line({ isOwnCompany: true })).scheme).toBe('excluded');
    expect(classifyLine(line({ type: 'უკან დაბრუნება' })).scheme).toBe('excluded');
    expect(classifyLine(line({ account: '2_1_60' })).scheme).toBe('fixed_asset');
    expect(classifyLine(line({ account: null })).scheme).toBe('none');
    expect(classifyLine(line({ supplierOris: null })).problems).toContain('Supplier has no ORIS ID');
    expect(classifyLine(line({ account: null, projectName: 'X', project1630: null })).problems).toContain('Project has no ORIS 1630 account');
    expect(buildEntries([line({ supplierOris: null })]).entries).toHaveLength(0);
  });

  it('builds the Sylfaen row and the CSV row in the ORIS font', () => {
    const { entries } = buildEntries([line()]);
    const row = sylfaenRow(entries[0]);
    expect(row.slice(0, 15)).toEqual(['873309993', 0, '20.01.2025', '1 6 20 10754', '3 1 10 2676', '', ' 593.22', 'GEL', expect.any(String), 1, '', 'ცალი', 14, 14, 'IMPORT']);
    const csv = csvRows(entries)[0];
    expect(csv.slice(0, 3)).toEqual(['', '', '']);
    expect(csv[14]).toBe('ÝÀËÉ');
    expect(csv[18]).toBe('ÓÉÓÔÄÌÉÓ ÀÃÌÉÍÉÓÔÒÀÔ');
    expect(String(csv[11])).toContain('ÓÀØÏÍÄËÉ: FAVORIT');
  });

  it('converts letters exactly like the sheet', () => {
    expect(toOrisFont('საქონელი')).toBe('ÓÀØÏÍÄËÉ');
    expect(toOrisFont('მ² მ³ ჯ ჰ')).toBe('Ì2 Ì3 ã ä');
    expect(isStockAccount('1_6_20_10754')).toBe(true);
    expect(isStockAccount('2_1_60_1')).toBe(true);
    expect(isStockAccount('1 6 70 03098')).toBe(true);
    expect(isStockAccount('1_6_35_1')).toBe(false);
    expect(isStockAccount('1 6 30 2492')).toBe(false);
  });
});
