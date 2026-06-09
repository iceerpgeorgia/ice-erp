import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

/**
 * POST /api/export/handover-template
 * Loads exact template from public folder and fills Placeholders sheet
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

    // Load template: try filesystem first (dev), fall back to HTTP fetch (Vercel production)
    let templateBuffer: Buffer;
    const templatePath = path.join(process.cwd(), 'public', 'handover template.xlsx');

    if (fs.existsSync(templatePath)) {
      templateBuffer = fs.readFileSync(templatePath);
      console.log('[Export Handover] Loaded template from filesystem:', templatePath);
    } else {
      // On Vercel, public/ files are served as static assets — fetch via HTTP
      const host = req.headers.get('host') || 'ice-erp.vercel.app';
      const protocol = host.startsWith('localhost') ? 'http' : 'https';
      const templateUrl = `${protocol}://${host}/handover%20template.xlsx`;
      console.log('[Export Handover] Fetching template via HTTP:', templateUrl);
      const fetchRes = await fetch(templateUrl);
      if (!fetchRes.ok) {
        return Response.json(
          { error: `Template not found via HTTP (${fetchRes.status}): ${templateUrl}` },
          { status: 404 }
        );
      }
      templateBuffer = Buffer.from(await fetchRes.arrayBuffer());
    }

    // Read workbook preserving all formatting and formulas
    const workbook = XLSX.read(templateBuffer, {
      cellFormula: true,
      cellNF: true,
      cellStyles: true,
      sheetStubs: true,
    });

    console.log('[Export Handover] Sheets:', workbook.SheetNames);

    // Fill Placeholders sheet
    if (workbook.Sheets['Placeholders']) {
      const sheet = workbook.Sheets['Placeholders'];

      // Helper to set cell value while preserving formatting
      const setCell = (cellRef: string, value: any, type: string) => {
        if (!sheet[cellRef]) sheet[cellRef] = {};
        sheet[cellRef].v = value;
        sheet[cellRef].t = type;
      };

      // Fill placeholder cells based on data provided
      console.log('[Export Handover] Filling placeholders with:', {
        certificateDate,
        counteragentInfo,
        companyName,
      });

      if (certificateDate) {
        const dateObj = new Date(certificateDate);
        // Convert to Excel serial for proper date handling
        const excelSerial = Math.floor((dateObj.getTime() - new Date(1900, 0, 1).getTime()) / (24 * 60 * 60 * 1000)) + 2;
        console.log('[Export Handover] Setting B2 (date) to serial:', excelSerial);
        setCell('B2', excelSerial, 'n'); // Handover_Date
      }

      if (counteragentInfo) {
        console.log('[Export Handover] Setting B4 (counteragent) to:', counteragentInfo);
        setCell('B4', counteragentInfo, 's'); // Project_Counteragent_Name
      }

      if (companyName) {
        console.log('[Export Handover] Setting B12 (company) to:', companyName);
        setCell('B12', companyName, 's'); // Project_Insider_Name
      }
    } else {
      console.error('[Export Handover] ERROR: Placeholders sheet not found in workbook!');
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
