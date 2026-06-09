import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/export/handover-template
 * Exports handover document using template-based approach
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      jobsData,
      certificateDate,
      counteragentInfo,
      companyName,
      fileName,
      projectUuid,
    } = body;

    if (!Array.isArray(jobsData) || !certificateDate || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields: jobsData, certificateDate, fileName' },
        { status: 400 }
      );
    }

    // Fetch project data if projectUuid provided
    let projectData: any = {};
    let counteragentData: any = {};
    let insiderData: any = {};

    if (projectUuid) {
      try {
        const project = await prisma.projects.findUnique({
          where: { project_uuid: projectUuid },
        });

        if (project) {
          projectData = project;

          // Fetch counteragent
          if (project.counteragent_uuid) {
            const ca = await prisma.counteragents.findUnique({
              where: { counteragent_uuid: project.counteragent_uuid },
            });
            if (ca) counteragentData = ca;
          }

          // Fetch insider
          if (project.insider_uuid) {
            const insider = await prisma.counteragents.findUnique({
              where: { counteragent_uuid: project.insider_uuid },
            });
            if (insider) insiderData = insider;
          }
        }
      } catch (error) {
        console.warn('[Export Handover] Failed to fetch project data:', error);
      }
    }

    // Load template
    const templatePath = path.join(process.cwd(), 'public', 'handover template.xlsx');
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: `Handover template not found at ${templatePath}` },
        { status: 404 }
      );
    }

    const templateBuffer = fs.readFileSync(templatePath);
    const workbook = XLSX.read(templateBuffer, { 
      cellFormula: true,
      cellNF: true,
      cellStyles: true,
      sheetStubs: true,
    });

    console.log('[Export Handover] Template sheets:', workbook.SheetNames);

    // Get the Handover sheet
    const handoverSheet = workbook.Sheets['Handover'];
    if (!handoverSheet) {
      return NextResponse.json(
        { error: 'Handover sheet not found in template' },
        { status: 400 }
      );
    }

    // ============================================
    // 1. Set certificate date in V3
    // ============================================
    const certDate = new Date(certificateDate);
    const excelDateSerial = dateToExcelSerial(certDate);
    if (!handoverSheet['V3']) {
      handoverSheet['V3'] = {};
    }
    handoverSheet['V3'].v = excelDateSerial;
    handoverSheet['V3'].t = 'n';

    // ============================================
    // 2. Replace placeholder text in Handover sheet (preserve formatting)
    // ============================================
    if (handoverSheet['C6']) {
      handoverSheet['C6'].v = counteragentInfo || 'შ.პ.ს აკმე ელვატორი';
      handoverSheet['C6'].t = 's';
    }

    if (handoverSheet['H69']) {
      handoverSheet['H69'].v = companyName || 'შპს აი-სი-ი';
      handoverSheet['H69'].t = 's';
    }

    // ============================================
    // 3. Populate Placeholders sheet
    // ============================================
    let placeholdersSheet = workbook.Sheets['Placeholders'];
    if (placeholdersSheet) {
      // Convert handover date to Excel serial
      const handoverDateSerial = dateToExcelSerial(certDate);
      
      const placeholders = [
        { col: 'B', row: 1, key: 'Project_Department', value: projectData.department || '', type: 's' },
        { col: 'B', row: 2, key: 'Handover_Date', value: handoverDateSerial, type: 'n' }, // Excel serial date
        { col: 'B', row: 3, key: 'Project_Counteragent_Entity_Type', value: counteragentData.entity_type || '', type: 's' },
        { col: 'B', row: 4, key: 'Project_Counteragent_Name', value: counteragentData.name || '', type: 's' },
        // Row 5: Project_Counteragent_Director_Genitive - SKIP (has formula)
        { col: 'B', row: 6, key: 'Project_Counteragent_Director', value: counteragentData.director || '', type: 's' },
        { col: 'B', row: 7, key: 'Project_Counteragent_Address_Line_1', value: counteragentData.address_line_1 || '', type: 's' },
        { col: 'B', row: 8, key: 'Project_Counteragent_Address_Line_2', value: counteragentData.address_line_2 || '', type: 's' },
        { col: 'B', row: 9, key: 'Project_Counteragent_ID', value: counteragentData.identification_number || '', type: 's' },
        { col: 'B', row: 10, key: 'Project_Address', value: projectData.address || '', type: 's' },
        { col: 'B', row: 11, key: 'Project_Insider_Entity_Type', value: insiderData.entity_type || '', type: 's' },
        { col: 'B', row: 12, key: 'Project_Insider_Name', value: insiderData.name || insiderData.insider_name || '', type: 's' },
        { col: 'B', row: 13, key: 'Project_Insider_ID', value: insiderData.identification_number || '', type: 's' },
        { col: 'B', row: 14, key: 'Project_Insider_Address_Line1', value: insiderData.address_line_1 || '', type: 's' },
        { col: 'B', row: 15, key: 'Project_Insider_Address_Line2', value: insiderData.address_line_2 || '', type: 's' },
        // Row 16: Project_Insider_Director_Genitive - SKIP (has formula)
        { col: 'B', row: 17, key: 'Project_Insider_Director_Normative', value: insiderData.director || '', type: 's' },
        // Row 18: Contract_Date - SKIP (leave blank)
        { col: 'B', row: 19, key: 'Project_Currency', value: projectData.currency || '', type: 's' },
      ];

      placeholders.forEach(ph => {
        const cellRef = `${ph.col}${ph.row}`;
        if (!placeholdersSheet[cellRef]) {
          placeholdersSheet[cellRef] = {};
        }
        // Preserve existing formatting, only update value and type
        placeholdersSheet[cellRef].v = ph.value;
        placeholdersSheet[cellRef].t = ph.type;
      });
    }

    // ============================================
    // 4. Populate or update Jobs sheet
    // ============================================
    let jobsSheet = workbook.Sheets['Jobs'];
    if (!jobsSheet) {
      jobsSheet = {};
      workbook.SheetNames.push('Jobs');
      workbook.Sheets['Jobs'] = jobsSheet;
    }

    // Add headers if they don't exist
    const headers = ['Counteragent ID', 'Factory No', 'Manufacturer', 'Floors', 'Weight', 'Nominal', '', '', '', '', 'GEL Amount', '', 'Date', 'Cert No'];
    for (let i = 0; i < headers.length; i++) {
      const colLetter = String.fromCharCode(65 + i);
      if (!jobsSheet[`${colLetter}1`]) {
        jobsSheet[`${colLetter}1`] = { v: headers[i], t: 's' };
      }
    }

    // Clear existing job data (rows > 1)
    const cellsToDelete = Object.keys(jobsSheet).filter((key) => {
      if (key === '!ref' || key === '!merges' || key.startsWith('!')) return false;
      const match = key.match(/\d+$/);
      const rowNum = parseInt(match ? match[0] : '0');
      return rowNum > 1;
    });
    cellsToDelete.forEach((key) => {
      delete jobsSheet[key];
    });

    // Populate job data rows starting from row 2
    jobsData.forEach((job, index) => {
      const rowNum = index + 2;

      if (job.counteragentId) {
        jobsSheet[`A${rowNum}`] = { v: job.counteragentId, t: 's' };
      }

      if (job.factoryNo) {
        jobsSheet[`B${rowNum}`] = { v: job.factoryNo, t: 's' };
      }

      if (job.manufacturerName) {
        jobsSheet[`C${rowNum}`] = { v: job.manufacturerName, t: 's' };
      }

      if (job.floors !== undefined && job.floors !== null) {
        jobsSheet[`D${rowNum}`] = { v: job.floors, t: 'n' };
      }

      if (job.weight !== undefined && job.weight !== null) {
        jobsSheet[`E${rowNum}`] = { v: Number(job.weight), t: 'n' };
      }

      if (job.nominalAmount !== undefined && job.nominalAmount !== null) {
        jobsSheet[`F${rowNum}`] = { v: Number(job.nominalAmount), t: 'n', z: '#,##0.00' };
      }

      if (job.gelAmount !== undefined && job.gelAmount !== null) {
        jobsSheet[`K${rowNum}`] = { v: Number(job.gelAmount), t: 'n', z: '#,##0.00' };
      }

      if (job.liftCertDate) {
        const jobCertDateSerial = dateToExcelSerial(
          typeof job.liftCertDate === 'string' ? new Date(job.liftCertDate) : new Date(job.liftCertDate)
        );
        jobsSheet[`M${rowNum}`] = { v: jobCertDateSerial, t: 'n' };
      }

      if (job.certificateNo) {
        jobsSheet[`N${rowNum}`] = { v: job.certificateNo, t: 's' };
      }
    });

    // Update sheet dimensions
    if (jobsData.length > 0) {
      jobsSheet['!ref'] = `A1:N${jobsData.length + 1}`;
    }

    // ============================================
    // 5. Export to buffer - preserve all sheets
    // ============================================
    console.log('[Export Handover] Exporting sheets:', workbook.SheetNames);
    
    const outputBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer',
    }) as Buffer;

    // ============================================
    // 6. Return file
    // ============================================
    console.log('[Export Handover] Returning buffer, size:', outputBuffer.length);

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Content-Length': outputBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Export Handover] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

/**
 * Convert JavaScript Date to Excel serial number
 */
function dateToExcelSerial(date: Date): number {
  const excelEpoch = new Date(1900, 0, 1).getTime();
  const dateTime = date.getTime();
  const daysDiff = Math.floor((dateTime - excelEpoch) / (24 * 60 * 60 * 1000));
  const serial = daysDiff + 1;

  if (serial > 60) {
    return serial + 1;
  }

  return serial;
}
