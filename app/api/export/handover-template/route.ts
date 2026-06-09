import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

/**
 * POST /api/export/handover-template
 * Exports handover template and fills placeholder cells with data
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fileName,
      certificateDate,
      counteragentInfo,
      companyName,
    } = body;

    if (!fileName) {
      return Response.json(
        { error: 'Missing required field: fileName' },
        { status: 400 }
      );
    }

    // Load template from root first, then public
    let templatePath = path.join(process.cwd(), 'handover template.xlsx');
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), 'public', 'handover template.xlsx');
    }
    if (!fs.existsSync(templatePath)) {
      return Response.json(
        { error: `Handover template not found` },
        { status: 404 }
      );
    }

    const templateBuffer = fs.readFileSync(templatePath);

    // Read workbook preserving all formatting and formulas
    const workbook = XLSX.read(templateBuffer, {
      cellFormula: true,
      cellNF: true,
      cellStyles: true,
      sheetStubs: true,
    });

    console.log('[Export Handover] Template loaded from:', templatePath);
    console.log('[Export Handover] Sheets:', workbook.SheetNames);

    // Fill placeholders in Handover sheet only
    if (workbook.Sheets['Handover']) {
      const sheet = workbook.Sheets['Handover'];

      // V3: Certificate date
      if (certificateDate && sheet['V3']) {
        const dateObj = new Date(certificateDate);
        const dateStr = dateObj.toISOString().split('T')[0];
        sheet['V3'].v = dateStr;
        sheet['V3'].t = 's';
      }

      // C6: Counteragent info
      if (counteragentInfo && sheet['C6']) {
        sheet['C6'].v = counteragentInfo;
        sheet['C6'].t = 's';
      }

      // H69: Company name
      if (companyName && sheet['H69']) {
        sheet['H69'].v = companyName;
        sheet['H69'].t = 's';
      }
    }

    // Strip namespace prefixes from ALL formulas in ALL sheets
    Object.keys(workbook.Sheets).forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      Object.keys(sheet).forEach((cellRef) => {
        const cell = sheet[cellRef];
        // Skip metadata cells (start with !)
        if (cellRef.startsWith('!')) return;
        
        // Remove namespace prefixes from formulas
        if (cell && cell.f && typeof cell.f === 'string') {
          // Remove _xlws. (worksheet namespace)
          cell.f = cell.f.replace(/^_xlws\./, '');
          cell.f = cell.f.replace(/_xlws\./g, '');
          // Remove _xlfn. (function namespace)
          cell.f = cell.f.replace(/_xlfn\./g, '');
          // Clean up any remaining namespace patterns
          cell.f = cell.f.replace(/^_[a-z]+\./gi, '');
        }
      });
    });

    // Write back to buffer
    const outputBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    console.log('[Export Handover] Placeholders filled, formulas cleaned, size:', outputBuffer.length);

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Content-Length': outputBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Export Handover] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}
