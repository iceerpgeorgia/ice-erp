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

    // Load template - check root first, then public
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

    console.log('[Export Handover] Template loaded, sheets:', workbook.SheetNames);

    // Fill placeholders in Handover sheet only
    if (workbook.Sheets['Handover']) {
      const sheet = workbook.Sheets['Handover'];

      // V3: Certificate date
      if (certificateDate) {
        const dateObj = new Date(certificateDate);
        const dateStr = dateObj.toISOString().split('T')[0];
        if (!sheet['V3']) sheet['V3'] = {};
        sheet['V3'].v = dateStr;
        sheet['V3'].t = 's';
      }

      // C6: Counteragent info
      if (counteragentInfo) {
        if (!sheet['C6']) sheet['C6'] = {};
        sheet['C6'].v = counteragentInfo;
        sheet['C6'].t = 's';
      }

      // H69: Company name
      if (companyName) {
        if (!sheet['H69']) sheet['H69'] = {};
        sheet['H69'].v = companyName;
        sheet['H69'].t = 's';
      }
    }

    // Write back to buffer
    const outputBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    console.log('[Export Handover] Template populated, size:', outputBuffer.length);

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
