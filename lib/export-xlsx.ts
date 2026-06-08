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

type ExportSheet<T> = {
  name: string;
  rows: T[];
  columns: ExportColumn[];
};

type ExportMultiSheetOptions<T> = {
  sheets: ExportSheet<T>[];
  fileName: string;
};

function toNumericValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('=')) {
      return null;
    }

    const normalized = trimmed
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, '')
      .replace(/[^0-9,.-]/g, '');

    if (!normalized || normalized === '.' || normalized === '-.' || normalized === '+.') {
      return null;
    }

    const hasDot = normalized.includes('.');
    const hasComma = normalized.includes(',');

    let canonical = normalized;
    if (hasDot && hasComma) {
      const lastDot = normalized.lastIndexOf('.');
      const lastComma = normalized.lastIndexOf(',');
      const decimalSeparator = lastDot > lastComma ? '.' : ',';
      const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';

      canonical = normalized
        .replaceAll(thousandsSeparator, '')
        .replace(decimalSeparator, '.');
    } else if (hasComma) {
      const commaParts = normalized.split(',');
      const lastPart = commaParts[commaParts.length - 1];
      const hasTwoOrFewerDigits = lastPart.length <= 2;
      const hasMultipleCommas = commaParts.length > 2;

      if (hasTwoOrFewerDigits && !hasMultipleCommas) {
        canonical = normalized.replaceAll(',', '.');
      } else {
        canonical = normalized.replaceAll(',', '');
      }
    }

    const parsed = Number(canonical);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

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
  const currencyColumnIndexes = visibleColumns
    .map((col, index) => (col.format === 'currency' || col.format === 'number' ? index : -1))
    .filter((index) => index >= 0);
  const percentColumnIndexes = visibleColumns
    .map((col, index) => (col.format === 'percent' ? index : -1))
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

      if (col.format === 'currency' || col.format === 'number') {
        const numericValue = toNumericValue(value);
        return numericValue ?? value;
      }

      if (col.format === 'percent') {
        const numericValue = toNumericValue(value);
        if (numericValue === null) return value;
        return Math.abs(numericValue) > 1 ? numericValue / 100 : numericValue;
      }

      return value;
    })
  );

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

  Object.values(worksheet).forEach((cell: any) => {
    if (cell && typeof cell.v === 'string' && cell.v.trim().startsWith('=')) {
      cell.t = 'n';
      cell.f = cell.v;
      cell.v = undefined;
    }
  });

  dateColumnIndexes.forEach((columnIndex) => {
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellRef];
      if (cell) {
        cell.z = 'dd.mm.yyyy';
      }
    }
  });

  currencyColumnIndexes.forEach((columnIndex) => {
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellRef];
      if (cell) {
        cell.z = '#,##0.00';
      }
    }
  });

  percentColumnIndexes.forEach((columnIndex) => {
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellRef];
      if (cell) {
        cell.z = '0.00%';
      }
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export multiple sheets to a single XLSX file.
 * Each sheet contains rows and columns as specified.
 */
export function exportMultiSheetsToXlsx<T extends Record<string, any>>({
  sheets,
  fileName,
}: ExportMultiSheetOptions<T>) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ name, rows, columns }) => {
    const visibleColumns = columns.filter((col) => col.visible !== false);
    const dateColumnIndexes = visibleColumns
      .map((col, index) => (col.format === 'date' ? index : -1))
      .filter((index) => index >= 0);
    const currencyColumnIndexes = visibleColumns
      .map((col, index) => (col.format === 'currency' || col.format === 'number' ? index : -1))
      .filter((index) => index >= 0);
    const percentColumnIndexes = visibleColumns
      .map((col, index) => (col.format === 'percent' ? index : -1))
      .filter((index) => index >= 0);
    const numberColumnIndexes = visibleColumns
      .map((col, index) => (col.format === 'currency' || col.format === 'number' || col.format === 'percent' ? index : -1))
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

        if (col.format === 'currency' || col.format === 'number') {
          const numericValue = toNumericValue(value);
          return numericValue ?? value;
        }

        if (col.format === 'percent') {
          const numericValue = toNumericValue(value);
          if (numericValue === null) return value;
          return Math.abs(numericValue) > 1 ? numericValue / 100 : numericValue;
        }

        return value;
      })
    );

    // Build totals row for numeric columns
    const totalsRow = visibleColumns.map((col, index) => {
      if (numberColumnIndexes.includes(index)) {
        // Sum all numeric values in this column
        const sum = dataRows.reduce((acc, row) => {
          const value = row[index];
          const numValue = toNumericValue(value);
          return acc + (numValue ?? 0);
        }, 0);
        return sum;
      }
      return '';
    });

    // Create worksheet data with header, data rows, and totals row
    const allData = [header, ...dataRows, totalsRow];
    const worksheet = XLSX.utils.aoa_to_sheet(allData);

    // Set up column widths with auto-adjustment
    const columnWidths = visibleColumns.map((col, colIndex) => {
      let maxWidth = col.label.length;
      
      // Check all data rows for width
      dataRows.forEach((row) => {
        const value = row[colIndex];
        const strValue = String(value ?? '').length;
        maxWidth = Math.max(maxWidth, strValue);
      });
      
      // Add padding
      return Math.min(maxWidth + 2, 50); // Cap at 50 for very long content
    });

    worksheet['!cols'] = columnWidths.map(width => ({ wch: width }));

    Object.values(worksheet).forEach((cell: any) => {
      if (cell && typeof cell.v === 'string' && cell.v.trim().startsWith('=')) {
        cell.t = 'n';
        cell.f = cell.v;
        cell.v = undefined;
      }
    });

    dateColumnIndexes.forEach((columnIndex) => {
      for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const cell = worksheet[cellRef];
        if (cell) {
          cell.z = 'dd.mm.yyyy';
        }
      }
    });

    currencyColumnIndexes.forEach((columnIndex) => {
      for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const cell = worksheet[cellRef];
        if (cell) {
          cell.z = '#,##0.00';
        }
      }
      // Format totals row currency as well
      const totalsRowRef = XLSX.utils.encode_cell({ r: rows.length + 1, c: columnIndex });
      const totalsCell = worksheet[totalsRowRef];
      if (totalsCell) {
        totalsCell.z = '#,##0.00';
        totalsCell.s = { b: true }; // Bold
      }
    });

    percentColumnIndexes.forEach((columnIndex) => {
      for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const cell = worksheet[cellRef];
        if (cell) {
          cell.z = '0.00%';
        }
      }
    });

    // Add table formatting
    const tableRange = {
      s: { r: 0, c: 0 },
      e: { r: dataRows.length, c: visibleColumns.length - 1 },
    };

    if (!worksheet['!table']) {
      worksheet['!table'] = {
        ref: XLSX.utils.encode_range(tableRange),
        name: `Table_${name}`,
        displayName: name,
        showHeader: 1,
        showFirstColumn: 0,
        showLastColumn: 0,
        showRowStripes: 1,
        showColumnStripes: 0,
        totalsRow: 1, // Show totals row
        tableStyleInfo: {
          name: 'TableStyleMedium2',
          showFirstColumn: false,
          showLastColumn: false,
          showRowStripes: true,
          showColumnStripes: false,
        },
      };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  });

  XLSX.writeFile(workbook, fileName);
}
