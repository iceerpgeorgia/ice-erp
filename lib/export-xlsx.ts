import * as XLSX from 'xlsx';

type ExportColumn = {
  key: string;
  label: string;
  visible?: boolean;
};

type ExportOptions<T> = {
  rows: T[];
  columns: ExportColumn[];
  fileName: string;
  sheetName?: string;
};

export function exportRowsToXlsx<T extends Record<string, any>>({
  rows,
  columns,
  fileName,
  sheetName = 'Sheet1',
}: ExportOptions<T>) {
  const visibleColumns = columns.filter((col) => col.visible !== false);
  const header = visibleColumns.map((col) => col.label);
  const dataRows = rows.map((row) =>
    visibleColumns.map((col) => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      return value;
    })
  );

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}
