import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

interface JobDataForTemplate {
  jobName: string;
  factoryNo: string;
  brandName: string;
  floors: number | string;
  nominalAmount: number;
  gelAmount: number;
  certificateNo: string;
  liftCertDate: string;
}

/**
 * POST /api/export/handover-template
 * Loads handover template, fills placeholders with data, and returns populated XLSX
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fileName,
      jobsData,
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

    // Read workbook with options to preserve formulas and formatting
    const workbook = XLSX.read(templateBuffer, {
      cellFormula: true,
      cellNF: true,
      cellStyles: true,
      sheetStubs: true,
    });

    console.log('[Export Handover] Template loaded, sheets:', workbook.SheetNames);

    // Fill placeholders in Handover sheet
    if (workbook.Sheets['Handover']) {
      const handoverSheet = workbook.Sheets['Handover'];

      // Set certificate date (cell V3)
      if (certificateDate) {
        const dateObj = new Date(certificateDate);
        const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
        if (!handoverSheet['V3']) handoverSheet['V3'] = {};
        handoverSheet['V3'].v = dateStr;
        handoverSheet['V3'].t = 'd'; // date type
      }

      // Set counteragent info (cell C6)
      if (counteragentInfo) {
        if (!handoverSheet['C6']) handoverSheet['C6'] = {};
        handoverSheet['C6'].v = counteragentInfo;
        handoverSheet['C6'].t = 's'; // string type
      }

      // Set company name (cell H69)
      if (companyName) {
        if (!handoverSheet['H69']) handoverSheet['H69'] = {};
        handoverSheet['H69'].v = companyName;
        handoverSheet['H69'].t = 's'; // string type
      }
    }

    // Populate Jobs sheet with data
    if (Array.isArray(jobsData) && jobsData.length > 0 && workbook.Sheets['Jobs']) {
      const jobsSheet = workbook.Sheets['Jobs'];

      // Start from row 2 (row 1 is header)
      (jobsData as JobDataForTemplate[]).forEach((job, idx) => {
        const row = idx + 2;

        // Define columns: A=jobName, B=factoryNo, C=brandName, D=floors, E=nominalAmount, F=gelAmount, G=certificateNo, H=liftCertDate
        const cellData = [
          { col: 'A', val: job.jobName },
          { col: 'B', val: job.factoryNo },
          { col: 'C', val: job.brandName },
          { col: 'D', val: job.floors },
          { col: 'E', val: job.nominalAmount },
          { col: 'F', val: job.gelAmount },
          { col: 'G', val: job.certificateNo },
          { col: 'H', val: job.liftCertDate },
        ];

        cellData.forEach(({ col, val }) => {
          const cellRef = `${col}${row}`;
          if (!jobsSheet[cellRef]) jobsSheet[cellRef] = {};
          jobsSheet[cellRef].v = val;
          // Auto-detect type
          if (typeof val === 'number') {
            jobsSheet[cellRef].t = 'n';
          } else {
            jobsSheet[cellRef].t = 's';
          }
        });
      });

      // Update sheet dimensions to include all data rows
      const lastRow = jobsData.length + 1;
      jobsSheet['!ref'] = `A1:H${lastRow}`;
    }

    // Write workbook to buffer
    const outputBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      cellFormula: true,
      cellNF: true,
      cellStyles: true,
    });

    console.log('[Export Handover] Template populated and written, size:', outputBuffer.length);

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
