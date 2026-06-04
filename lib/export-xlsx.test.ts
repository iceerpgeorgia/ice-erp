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
  it('writes numeric currency strings as real numeric Excel values', () => {
    const writeFileMock = XLSX.writeFile as jest.Mock;
    writeFileMock.mockClear();

    exportRowsToXlsx({
      rows: [{ amount: '233,110.00' }],
      columns: [{ key: 'amount', label: 'Amount', format: 'currency' }],
      fileName: 'sample.xlsx',
      sheetName: 'Report',
    });

    const aoaToSheetMock = (XLSX.utils.aoa_to_sheet as unknown) as jest.Mock;
    const worksheet = aoaToSheetMock.mock.results[0]?.value as Record<string, any>;

    expect(worksheet.A2).toBeDefined();
    expect(typeof worksheet.A2.v).toBe('number');
    expect(worksheet.A2.v).toBe(233110);
    expect(writeFileMock).toHaveBeenCalledTimes(1);
  });
});
