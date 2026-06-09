import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { toGenitiveCase } from '@/lib/georgian-genitive';

const prisma = new PrismaClient();

/**
 * POST /api/export/handover-template
 * Loads exact template from public folder and fills ALL 19 Placeholders from database
 * 
 * Required body fields:
 * - fileName: output filename
 * - projectUuid: project UUID to load data for
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, projectUuid } = body;

    if (!fileName || !projectUuid) {
      return Response.json(
        { error: 'Missing required fields: fileName, projectUuid' },
        { status: 400 }
      );
    }

    console.log('[Export Handover] Starting export for project:', projectUuid);

    // Fetch template from public folder
    let templateBuffer: Buffer;
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    const templateUrl = `${protocol}://${host}/handover%20template.xlsx`;

    console.log('[Export Handover] Fetching template from:', templateUrl);

    try {
      const fetchRes = await fetch(templateUrl, { cache: 'no-store' });
      if (!fetchRes.ok) {
        console.error(`[Export Handover] Failed to fetch template: ${fetchRes.status} ${fetchRes.statusText}`);
        return Response.json(
          { error: `Template fetch failed (${fetchRes.status})` },
          { status: 404 }
        );
      }
      templateBuffer = Buffer.from(await fetchRes.arrayBuffer());
      console.log('[Export Handover] Template fetched, size:', templateBuffer.length);
    } catch (fetchErr) {
      console.error('[Export Handover] Template fetch error:', fetchErr);
      return Response.json(
        { error: `Failed to fetch template: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Query project and all related data
    console.log('[Export Handover] Querying database for project:', projectUuid);

    const project = await prisma.projects.findUnique({
      where: { project_uuid: projectUuid },
    });

    if (!project) {
      console.error('[Export Handover] Project not found:', projectUuid);
      return Response.json(
        { error: `Project not found: ${projectUuid}` },
        { status: 404 }
      );
    }

    // Query counteragent (supplier/contractor)
    const counteragent = await prisma.counteragents.findUnique({
      where: { counteragent_uuid: project.counteragent_uuid },
    });

    // Query insider (our company)
    const insider = await prisma.counteragents.findUnique({
      where: { counteragent_uuid: project.insider_uuid },
    });

    // Query currency
    const currency = await prisma.currencies.findUnique({
      where: { uuid: project.currency_uuid },
    });

    console.log('[Export Handover] Data loaded - project:', project.project_name, 'counteragent:', counteragent?.name, 'insider:', insider?.name);

    // Read workbook with minimal options - preserve all sheets exactly as they are
    console.log('[Export Handover] Reading template with XLSX...');
    const workbook = XLSX.read(templateBuffer);
    
    console.log('[Export Handover] Sheets in workbook:', Object.keys(workbook.Sheets));
    
    // Log sample formulas from Handover sheet BEFORE any modifications
    const handoverSheetBefore = workbook.Sheets['Handover'];
    if (handoverSheetBefore) {
      console.log('[Export Handover] --- BEFORE PROCESSING - Handover sheet formulas:');
      ['C4', 'C5', 'C6', 'V3', 'C7', 'C8'].forEach(cellRef => {
        const cell = handoverSheetBefore[cellRef];
        if (cell && cell.f) {
          console.log(`[Export Handover]   ${cellRef}: formula="${cell.f}" value="${cell.v}"`);
        }
      });
    }

    // Fill Placeholders sheet with ALL 19 fields from database
    if (workbook.Sheets['Placeholders']) {
      const sheet = workbook.Sheets['Placeholders'];

      // Preserve cell formatting while updating values
      const setCell = (cellRef: string, value: any, type: string) => {
        const existingCell = sheet[cellRef] || {};
        // Keep all existing cell properties (formatting, borders, colors, etc.)
        sheet[cellRef] = {
          ...existingCell,
          v: value,
          t: type,
        };
      };

      // Convert date to Excel serial
      const dateToExcelSerial = (date: Date | string | null): number => {
        if (!date) return 0;
        const d = typeof date === 'string' ? new Date(date) : date;
        return Math.floor((d.getTime() - new Date(1900, 0, 1).getTime()) / (24 * 60 * 60 * 1000)) + 2;
      };

      const placeholderData = {
        'B1': project.department || '', // Project_Department (A1)
        'B2': dateToExcelSerial(project.date), // Handover_Date - use certificate/contract date (A2)
        'B3': counteragent?.entity_type || '', // Project_Counteragent_Entity_Type (A3)
        'B4': counteragent?.name || '', // Project_Counteragent_Name (A4)
        'B5': toGenitiveCase(counteragent?.director), // Project_Counteragent_Director_Genitive (A5)
        'B6': counteragent?.director || '', // Project_Counteragent_Director (A6)
        'B7': counteragent?.address_line_1 || '', // Project_Counteragent_Address_Line_1 (A7)
        'B8': counteragent?.address_line_2 || '', // Project_Counteragent_Address_Line_2 (A8)
        'B9': counteragent?.identification_number || '', // Project_Counteragent_ID (A9)
        'B10': project.address || '', // Project_Address (A10)
        'B11': insider?.entity_type || '', // Project_Insider_Entity_Type (A11)
        'B12': insider?.name || '', // Project_Insider_Name (A12)
        'B13': insider?.identification_number || '', // Project_Insider_ID (A13)
        'B14': insider?.address_line_1 || '', // Project_Insider_Address_Line1 (A14)
        'B15': insider?.address_line_2 || '', // Project_Insider_Address_Line2 (A15)
        'B16': toGenitiveCase(insider?.director), // Project_Insider_Director_Genitive (A16)
        'B17': insider?.director || '', // Project_Insider_Director_Normative (A17)
        'B18': dateToExcelSerial(project.date), // Contract_Date - project's certificate date (A18)
        'B19': currency?.code || '', // Project_Currency (A19)
      };

      console.log('[Export Handover] Filling all 19 placeholders:');
      Object.entries(placeholderData).forEach(([cell, value]) => {
        const isDateCell = cell === 'B2' || cell === 'B18';
        const type = isDateCell ? 'n' : 's';
        setCell(cell, value, type);
        console.log(`[Export Handover] ${cell}: ${String(value).substring(0, 50)}`);
      });
    } else {
      console.error('[Export Handover] ERROR: Placeholders sheet not found!');
      return Response.json(
        { error: 'Placeholders sheet not found in template' },
        { status: 500 }
      );
    }

    // Clean up namespace prefixes from ALL formulas in ALL sheets
    // XLSX adds _xlws. and _xlfn. prefixes to modern Excel functions
    // These need to be stripped before writing to preserve original formulas
    console.log('[Export Handover] --- Cleaning namespace prefixes from formulas:');
    let formulasModified = 0;
    let formulasWithIssues: { sheet: string; cell: string; before: string; after: string }[] = [];
    
    Object.keys(workbook.Sheets).forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      Object.keys(sheet).forEach((cellRef) => {
        if (cellRef.startsWith('!')) return;
        const cell = sheet[cellRef];
        if (cell && cell.f && typeof cell.f === 'string') {
          const beforeFormula = cell.f;
          
          // Remove namespace prefixes: _xlws., _xlfn., etc.
          cell.f = cell.f.replace(/^_xlws\./g, '');
          cell.f = cell.f.replace(/_xlws\./g, '');
          cell.f = cell.f.replace(/^_xlfn\./g, '');
          cell.f = cell.f.replace(/_xlfn\./g, '');
          
          // Log if formula changed
          if (beforeFormula !== cell.f) {
            formulasModified++;
            if (sheetName === 'Handover' || sheetName === 'Placeholders') {
              formulasWithIssues.push({
                sheet: sheetName,
                cell: cellRef,
                before: beforeFormula,
                after: cell.f,
              });
            }
          }
        }
      });
    });
    
    console.log(`[Export Handover] Modified ${formulasModified} formulas`);
    formulasWithIssues.forEach(issue => {
      console.log(`[Export Handover]   ${issue.sheet}!${issue.cell}:`);
      console.log(`[Export Handover]     BEFORE: ${issue.before.substring(0, 100)}`);
      console.log(`[Export Handover]     AFTER:  ${issue.after.substring(0, 100)}`);
    });

    // Write workbook - formulas should now be clean
    console.log('[Export Handover] Writing workbook to buffer...');
    const outputBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    // Log sample formulas from output to verify
    console.log('[Export Handover] --- AFTER WRITE - Re-reading output to verify:');
    const verifyWorkbook = XLSX.read(outputBuffer);
    const verifyHandover = verifyWorkbook.Sheets['Handover'];
    if (verifyHandover) {
      ['C4', 'C5', 'C6', 'V3', 'C7', 'C8'].forEach(cellRef => {
        const cell = verifyHandover[cellRef];
        if (cell && cell.f) {
          console.log(`[Export Handover]   ${cellRef}: formula="${cell.f}" value="${cell.v}"`);
        } else if (cell) {
          console.log(`[Export Handover]   ${cellRef}: NO FORMULA, value="${cell.v}"`);
        }
      });
    }

    console.log('[Export Handover] Export complete, file size:', outputBuffer.length);

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
  } finally {
    await prisma.$disconnect();
  }
}
