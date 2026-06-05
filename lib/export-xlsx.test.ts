import * as XLSX from 'xlsx';
import { exportRowsToXlsx } from './export-xlsx';

jest.mock('xlsx', () => {
  const actual = jest.requireActual('xlsx');

  return {
    ...actual,
    utils: {
      ...actual.utils,
      aoa_to_sheet: jest.fn((rows: any[][]) => {
        const worksheet: Record<string, any> = {};

        rows.forEach((row, rowIndex) => {
          row.forEach((value, colIndex) => {
            const cellRef = actual.utils.encode_cell({ r: rowIndex, c: colIndex });

            if (typeof value === 'string' && value.startsWith('=')) {
              worksheet[cellRef] = {
                t: 'n',
                f: value,
                v: value,
                z: '',
              };
              return;
            }

            worksheet[cellRef] = {
              t: typeof value === 'number' ? 'n' : 's',
              v: value,
              z: '',
            };
          });
        });

        return worksheet;
      }),
      book_new: jest.fn(() => ({})),
      book_append_sheet: jest.fn(),
    },
    writeFile: jest.fn(),
  };
});

describe('exportRowsToXlsx', () => {
  it('preserves formula strings in exported cells', () => {
    const writeFileMock = XLSX.writeFile as jest.Mock;
    const aoaToSheetMock = XLSX.utils.aoa_to_sheet as unknown as jest.Mock;
    writeFileMock.mockClear();
    aoaToSheetMock.mockClear();

    exportRowsToXlsx({
      rows: [{ distributedAmount: '=B2*N2' }],
      columns: [{ key: 'distributedAmount', label: 'Distributed Amount', format: 'currency' }],
      fileName: 'formula.xlsx',
      sheetName: 'Report',
    });

    const worksheet = aoaToSheetMock.mock.results[0]?.value as Record<string, any>;

    expect(worksheet.A2).toBeDefined();
    expect(worksheet.A2.f).toBe('=B2*N2');
    expect(worksheet.A2.t).toBe('n');
    expect(writeFileMock).toHaveBeenCalledTimes(1);
  });

  it('writes numeric currency strings as real numeric Excel values', () => {
    const writeFileMock = XLSX.writeFile as jest.Mock;
    const aoaToSheetMock = XLSX.utils.aoa_to_sheet as unknown as jest.Mock;
    writeFileMock.mockClear();
    aoaToSheetMock.mockClear();

    exportRowsToXlsx({
      rows: [{ amount: '233,110.00' }],
      columns: [{ key: 'amount', label: 'Amount', format: 'currency' }],
      fileName: 'sample.xlsx',
      sheetName: 'Report',
    });

    const worksheet = aoaToSheetMock.mock.results[0]?.value as Record<string, any>;

    expect(worksheet.A2).toBeDefined();
    expect(typeof worksheet.A2.v).toBe('number');
    expect(worksheet.A2.v).toBe(233110);
    expect(writeFileMock).toHaveBeenCalledTimes(1);
  });
});
