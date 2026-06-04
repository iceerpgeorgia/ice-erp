import * as XLSX from 'xlsx';

type ExportColumn = {
  key: string;
  label: string;
  visible?: boolean;
  format?: string;
};

type ExportOptions<T> = {
  rows: T[];
  columns: ExportColumn[];
  fileName: string;
  sheetName?: string;
};

function toExcelDateSerial(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const dateValue = typeof value === 'string' ? value.trim() : value;
  if (typeof dateValue === 'number') {
    return dateValue;
  }

  if (typeof dateValue === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}/.test(dateValue) && !/^\d{2}\.\d{2}\.\d{4}/.test(dateValue)) {
      return null;
    }

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return null;

    return (parsed.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
  }

  if (dateValue instanceof Date) {
    return (dateValue.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
  }

  return null;
}

export function exportRowsToXlsx<T extends Record<string, any>>({
  rows,
  columns,
  fileName,
  sheetName = 'Sheet1',
}: ExportOptions<T>) {
  const visibleColumns = columns.filter((col) => col.visible !== false);
  const dateColumnIndexes = visibleColumns
    .map((col, index) => (col.format === 'date' ? index : -1))
    .filter((index) => index >= 0);

  const header = visibleColumns.map((col) => col.label);
  const dataRows = rows.map((row) =>
    visibleColumns.map((col) => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';

      if (col.format === 'date') {
        const serial = toExcelDateSerial(value);
        return serial ?? value;
      }

      return value;
    })
  );

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

  dateColumnIndexes.forEach((columnIndex) => {
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellRef];
      if (cell) {
        cell.z = 'dd.mm.yyyy';
      }
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}
